locals {
  name_prefix = "${var.name_prefix}-lobby"

  common_tags = {
    Project     = var.project
    Environment = var.environment
  }
}

resource "aws_ecr_repository" "lobby" {
  name = local.name_prefix

  # The dev deploy workflow currently pushes both an immutable git-SHA tag and
  # a refreshed :latest tag for simple force-new-deployment demos. Keep tags
  # mutable until the pipeline switches to SHA-only task definitions.
  image_tag_mutability = "MUTABLE"

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
      {
        rulePriority = 1
        description  = "Keep the most recent 20 lobby images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 20
        }
        action = { type = "expire" }
      }
    ]
  })
}
