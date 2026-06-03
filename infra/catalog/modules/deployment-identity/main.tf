# GitHub Actions OIDC provider
# Allows GitHub Actions to assume IAM roles without long-lived credentials.
# The provider itself is account-level shared infrastructure created by the
# github-oidc-provider unit, then reused by each environment's roles.

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

# Plan role — used on pull requests for terraform plan
resource "aws_iam_role" "github_plan" {
  name                 = "${var.name_prefix}-github-plan"
  description          = "GitHub Actions OIDC role for pull-request Terraform plans"
  max_session_duration = 3600
  permissions_boundary = local.lab_gitops_oidc_apply_permissions_boundary_arn

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = data.aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:pull_request"
          }
        }
      }
    ]
  })

  tags = {
    Project     = var.project
    Environment = var.environment
    Role        = "github-plan"
  }
}

# Apply role — used on main branch for terraform apply and deployments
resource "aws_iam_role" "github_apply" {
  name                 = "${var.name_prefix}-github-apply"
  description          = "GitHub Actions OIDC role for environment-scoped Terraform applies"
  max_session_duration = 3600
  permissions_boundary = local.lab_gitops_oidc_apply_permissions_boundary_arn

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = data.aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:environment:${var.environment}"
          }
        }
      }
    ]
  })

  tags = {
    Project     = var.project
    Environment = var.environment
    Role        = "github-apply"
  }
}

# Plan policy — read-only: terraform plan, read state
resource "aws_iam_policy" "github_plan" {
  name        = "${var.name_prefix}-github-plan-policy"
  description = "Permissions for GitHub Actions terraform plan"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadEnvironmentStateObjects"
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = local.terraform_state_environment_objects
      },
      {
        Sid    = "ListEnvironmentStatePrefix"
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = local.terraform_state_bucket_arn
        Condition = {
          StringLike = {
            "s3:prefix" = [
              local.terraform_state_environment_prefix,
              "${local.terraform_state_environment_prefix}/*"
            ]
          }
        }
      },
      {
        Sid    = "WriteEnvironmentStateLockFiles"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = local.terraform_state_environment_lock_files
      },
      {
        Sid    = "ReadStaticSiteBucketConfiguration"
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetAccelerateConfiguration",
          "s3:GetBucket*",
          "s3:GetEncryptionConfiguration",
          "s3:GetLifecycleConfiguration",
          "s3:GetReplicationConfiguration"
        ]
        Resource = local.static_site_bucket_arn
      },
      {
        Sid    = "ReadStaticSiteObjects"
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = local.static_site_bucket_objects_arn
      },
      {
        Sid    = "ReadStaticSiteCloudFront"
        Effect = "Allow"
        Action = [
          "cloudfront:Get*",
          "cloudfront:List*"
        ]
        Resource = "*"
      },
      {
        Sid    = "ReadStaticSiteAcm"
        Effect = "Allow"
        Action = [
          "acm:DescribeCertificate",
          "acm:GetCertificate",
          "acm:ListCertificates",
          "acm:ListTagsForCertificate"
        ]
        Resource = "*"
      },
      {
        Sid    = "ReadStaticSiteRoute53"
        Effect = "Allow"
        Action = [
          "route53:GetHostedZone",
          "route53:ListHostedZones",
          "route53:ListResourceRecordSets",
          "route53:ListTagsForResource"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# Apply policy — write: terraform apply, S3 sync, ECR push, ECS deploy
resource "aws_iam_policy" "github_apply" {
  name        = "${var.name_prefix}-github-apply-policy"
  description = "Permissions for GitHub Actions terraform apply and deployments"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ManageEnvironmentStateObjects"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = local.terraform_state_environment_objects
      },
      {
        Sid    = "ListEnvironmentStatePrefix"
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = local.terraform_state_bucket_arn
        Condition = {
          StringLike = {
            "s3:prefix" = [
              local.terraform_state_environment_prefix,
              "${local.terraform_state_environment_prefix}/*"
            ]
          }
        }
      },
      {
        Sid    = "ManageStaticSiteBucketConfiguration"
        Effect = "Allow"
        Action = [
          "s3:CreateBucket",
          "s3:DeleteBucket",
          "s3:ListBucket",
          "s3:GetAccelerateConfiguration",
          "s3:GetBucket*",
          "s3:GetEncryptionConfiguration",
          "s3:GetLifecycleConfiguration",
          "s3:GetReplicationConfiguration",
          "s3:PutBucketPolicy",
          "s3:DeleteBucketPolicy",
          "s3:PutBucketTagging",
          "s3:DeleteBucketTagging",
          "s3:PutBucketVersioning",
          "s3:PutEncryptionConfiguration",
          "s3:PutBucketPublicAccessBlock"
        ]
        Resource = local.static_site_bucket_arn
      },
      {
        Sid    = "ManageStaticSiteObjects"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:AbortMultipartUpload",
          "s3:ListMultipartUploadParts"
        ]
        Resource = local.static_site_bucket_objects_arn
      },
      {
        Sid    = "DenyPublicStaticSiteObjectAcls"
        Effect = "Deny"
        Action = [
          "s3:PutObject"
        ]
        Resource = local.static_site_bucket_objects_arn
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = [
              "public-read",
              "public-read-write",
              "authenticated-read"
            ]
          }
        }
      },
      {
        Sid    = "DenyStaticSitePublicAclsNotBlocked"
        Effect = "Deny"
        Action = [
          "s3:PutBucketPublicAccessBlock"
        ]
        Resource = local.static_site_bucket_arn
        Condition = {
          Bool = {
            "s3:PublicAccessBlockConfiguration/BlockPublicAcls" = "false"
          }
        }
      },
      {
        Sid    = "DenyStaticSitePublicAclsNotIgnored"
        Effect = "Deny"
        Action = [
          "s3:PutBucketPublicAccessBlock"
        ]
        Resource = local.static_site_bucket_arn
        Condition = {
          Bool = {
            "s3:PublicAccessBlockConfiguration/IgnorePublicAcls" = "false"
          }
        }
      },
      {
        Sid    = "DenyStaticSitePublicPoliciesNotBlocked"
        Effect = "Deny"
        Action = [
          "s3:PutBucketPublicAccessBlock"
        ]
        Resource = local.static_site_bucket_arn
        Condition = {
          Bool = {
            "s3:PublicAccessBlockConfiguration/BlockPublicPolicy" = "false"
          }
        }
      },
      {
        Sid    = "DenyStaticSitePublicBucketsNotRestricted"
        Effect = "Deny"
        Action = [
          "s3:PutBucketPublicAccessBlock"
        ]
        Resource = local.static_site_bucket_arn
        Condition = {
          Bool = {
            "s3:PublicAccessBlockConfiguration/RestrictPublicBuckets" = "false"
          }
        }
      },
      {
        Sid    = "ManageStaticSiteCloudFront"
        Effect = "Allow"
        Action = [
          "cloudfront:CreateCachePolicy",
          "cloudfront:CreateDistribution",
          "cloudfront:CreateInvalidation",
          "cloudfront:CreateOriginAccessControl",
          "cloudfront:DeleteCachePolicy",
          "cloudfront:DeleteDistribution",
          "cloudfront:DeleteOriginAccessControl",
          "cloudfront:Get*",
          "cloudfront:List*",
          "cloudfront:TagResource",
          "cloudfront:UntagResource",
          "cloudfront:UpdateCachePolicy",
          "cloudfront:UpdateDistribution",
          "cloudfront:UpdateOriginAccessControl"
        ]
        Resource = "*"
      },
      {
        Sid    = "ManageStaticSiteAcm"
        Effect = "Allow"
        Action = [
          "acm:AddTagsToCertificate",
          "acm:DeleteCertificate",
          "acm:DescribeCertificate",
          "acm:GetCertificate",
          "acm:ListCertificates",
          "acm:ListTagsForCertificate",
          "acm:RemoveTagsFromCertificate",
          "acm:RequestCertificate"
        ]
        Resource = "*"
      },
      {
        Sid    = "ManageStaticSiteRoute53"
        Effect = "Allow"
        Action = [
          "route53:ChangeResourceRecordSets",
          "route53:GetChange",
          "route53:GetHostedZone",
          "route53:ListHostedZones",
          "route53:ListResourceRecordSets",
          "route53:ListTagsForResource"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "github_plan" {
  role       = aws_iam_role.github_plan.name
  policy_arn = aws_iam_policy.github_plan.arn
}

resource "aws_iam_role_policy_attachment" "github_apply" {
  role       = aws_iam_role.github_apply.name
  policy_arn = aws_iam_policy.github_apply.arn
}
