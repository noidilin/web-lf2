locals {
  name_prefix = "${var.name_prefix}-lobby"

  common_tags = {
    Project     = var.project
    Environment = var.environment
  }
}

resource "aws_ecr_repository" "lobby" {
  name = local.name_prefix

  # Deployment workflows publish canonical sha-<git sha> image tags and ECS
  # task definitions select those tags directly, so ECR rejects SHA rewrites while
  # allowing mutable environment aliases for human inspection.
  image_tag_mutability = "IMMUTABLE_WITH_EXCLUSION"

  image_tag_mutability_exclusion_filter {
    filter      = "dev"
    filter_type = "WILDCARD"
  }

  image_tag_mutability_exclusion_filter {
    filter      = "prod"
    filter_type = "WILDCARD"
  }

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = local.common_tags
}

resource "aws_ecr_lifecycle_policy" "lobby" {
  repository = aws_ecr_repository.lobby.name

  policy = jsonencode({
    rules = [
      # ECR lifecycle policies do not have an explicit "keep" action. This
      # high-priority alias rule keeps dev/prod-tagged images out of lower
      # priority SHA cleanup while still leaving an eventual safety valve.
      {
        rulePriority = 1
        description  = "Protect environment alias images from SHA cleanup"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["dev", "prod"]
          countType     = "imageCountMoreThan"
          countNumber   = 9999
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep the most recent 20 SHA-tagged lobby images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["sha-"]
          countType     = "imageCountMoreThan"
          countNumber   = 20
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 3
        description  = "Expire untagged lobby images after one day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      }
    ]
  })
}
