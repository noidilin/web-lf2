# GitHub Actions OIDC provider
# Allows GitHub Actions to assume IAM roles without long-lived credentials.
# The provider itself is account-level shared infrastructure created by the
# github-oidc-provider unit, then reused by each environment's roles.

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

# Plan role — used on pull requests and main-branch deploy preflight for terraform plan
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
            "token.actions.githubusercontent.com:sub" = [
              "repo:${var.github_repo}:pull_request",
              "repo:${var.github_repo}:ref:refs/heads/main"
            ]
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
      },
      {
        Sid    = "ReadLobbyInfrastructure"
        Effect = "Allow"
        Action = [
          "ec2:Describe*",
          "ecr:DescribeImages",
          "ecr:DescribeRepositories",
          "ecr:GetLifecyclePolicy",
          "ecr:ListTagsForResource",
          "ecs:Describe*",
          "ecs:List*",
          "elasticloadbalancing:Describe*",
          "iam:GetRole",
          "iam:ListAttachedRolePolicies",
          "iam:ListRolePolicies",
          "logs:DescribeLogGroups",
          "logs:ListTagsForResource"
        ]
        Resource = "*"
      },
      {
        Sid    = "ReadObservabilityInfrastructure"
        Effect = "Allow"
        Action = [
          "cloudwatch:DescribeAlarms",
          "cloudwatch:DescribeAlarmHistory",
          "cloudwatch:GetDashboard",
          "cloudwatch:ListDashboards",
          "cloudwatch:ListTagsForResource",
          "sns:GetSubscriptionAttributes",
          "sns:GetTopicAttributes",
          "sns:ListSubscriptionsByTopic",
          "sns:ListTagsForResource"
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

# Apply policies — write: terraform apply, S3 sync, ECR push, ECS deploy.
# Split across multiple managed policies to stay below the IAM managed policy
# 6,144-character document quota while keeping each permission area scoped.
resource "aws_iam_policy" "github_apply" {
  name        = "${var.name_prefix}-github-apply-policy"
  description = "Core permissions for GitHub Actions terraform apply"

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

resource "aws_iam_policy" "github_apply_lobby" {
  name        = "${var.name_prefix}-github-apply-lobby-policy"
  description = "Lobby deployment permissions for GitHub Actions terraform apply"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ManageLobbyEcr"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:CompleteLayerUpload",
          "ecr:CreateRepository",
          "ecr:DeleteLifecyclePolicy",
          "ecr:DeleteRepository",
          "ecr:DescribeImages",
          "ecr:DescribeRepositories",
          "ecr:GetDownloadUrlForLayer",
          "ecr:GetLifecyclePolicy",
          "ecr:InitiateLayerUpload",
          "ecr:ListImages",
          "ecr:ListTagsForResource",
          "ecr:PutImage",
          "ecr:PutImageScanningConfiguration",
          "ecr:PutImageTagMutability",
          "ecr:PutLifecyclePolicy",
          "ecr:TagResource",
          "ecr:UntagResource",
          "ecr:UploadLayerPart"
        ]
        Resource = local.lobby_ecr_repository_arn
      },
      {
        Sid      = "GetEcrAuthorizationToken"
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
        Sid    = "ManageLobbyCompute"
        Effect = "Allow"
        Action = [
          "ecs:CreateCluster",
          "ecs:CreateService",
          "ecs:DeleteCluster",
          "ecs:DeleteService",
          "ecs:DeregisterTaskDefinition",
          "ecs:Describe*",
          "ecs:List*",
          "ecs:RegisterTaskDefinition",
          "ecs:TagResource",
          "ecs:UntagResource",
          "ecs:UpdateCluster",
          "ecs:UpdateService",
          "ecs:UpdateServicePrimaryTaskSet",
          "elasticloadbalancing:AddTags",
          "elasticloadbalancing:CreateListener",
          "elasticloadbalancing:CreateLoadBalancer",
          "elasticloadbalancing:CreateTargetGroup",
          "elasticloadbalancing:DeleteListener",
          "elasticloadbalancing:DeleteLoadBalancer",
          "elasticloadbalancing:DeleteTargetGroup",
          "elasticloadbalancing:Describe*",
          "elasticloadbalancing:ModifyListener",
          "elasticloadbalancing:ModifyLoadBalancerAttributes",
          "elasticloadbalancing:ModifyTargetGroup",
          "elasticloadbalancing:ModifyTargetGroupAttributes",
          "elasticloadbalancing:RemoveTags"
        ]
        Resource = "*"
      },
      {
        Sid    = "ManageLobbyNetworking"
        Effect = "Allow"
        Action = [
          "ec2:AllocateAddress",
          "ec2:AssociateRouteTable",
          "ec2:AttachInternetGateway",
          "ec2:CreateInternetGateway",
          "ec2:CreateNatGateway",
          "ec2:CreateRoute",
          "ec2:CreateRouteTable",
          "ec2:CreateSecurityGroup",
          "ec2:CreateSubnet",
          "ec2:CreateTags",
          "ec2:CreateVpc",
          "ec2:DeleteInternetGateway",
          "ec2:DeleteNatGateway",
          "ec2:DeleteRoute",
          "ec2:DeleteRouteTable",
          "ec2:DeleteSecurityGroup",
          "ec2:DeleteSubnet",
          "ec2:DeleteVpc",
          "ec2:Describe*",
          "ec2:DetachInternetGateway",
          "ec2:DisassociateRouteTable",
          "ec2:ModifySubnetAttribute",
          "ec2:ModifyVpcAttribute",
          "ec2:ReleaseAddress",
          "ec2:RevokeSecurityGroupEgress",
          "ec2:RevokeSecurityGroupIngress",
          "ec2:AuthorizeSecurityGroupEgress",
          "ec2:AuthorizeSecurityGroupIngress"
        ]
        Resource = "*"
      },
      {
        Sid    = "ManageLobbyLogsAndAcm"
        Effect = "Allow"
        Action = [
          "acm:AddTagsToCertificate",
          "acm:DeleteCertificate",
          "acm:DescribeCertificate",
          "acm:GetCertificate",
          "acm:ListCertificates",
          "acm:ListTagsForCertificate",
          "acm:RemoveTagsFromCertificate",
          "acm:RequestCertificate",
          "logs:CreateLogGroup",
          "logs:DeleteLogGroup",
          "logs:DescribeLogGroups",
          "logs:ListTagsForResource",
          "logs:PutRetentionPolicy",
          "logs:TagResource",
          "logs:UntagResource"
        ]
        Resource = "*"
      },
      {
        Sid    = "ManageLobbyIamRoles"
        Effect = "Allow"
        Action = [
          "iam:AttachRolePolicy",
          "iam:CreateRole",
          "iam:DeleteRole",
          "iam:DetachRolePolicy",
          "iam:GetRole",
          "iam:ListAttachedRolePolicies",
          "iam:ListInstanceProfilesForRole",
          "iam:ListRolePolicies",
          "iam:PutRolePermissionsBoundary",
          "iam:TagRole",
          "iam:UntagRole"
        ]
        Resource = local.lobby_iam_roles_arn
      },
      {
        Sid      = "PassLobbyRolesToEcsTasks"
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = local.lobby_iam_roles_arn
        Condition = {
          StringEquals = {
            "iam:PassedToService" = "ecs-tasks.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

resource "aws_iam_policy" "github_apply_observability" {
  name        = "${var.name_prefix}-github-apply-observability-policy"
  description = "Observability permissions for GitHub Actions terraform apply"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ManageObservabilityInfrastructure"
        Effect = "Allow"
        Action = [
          "cloudwatch:DeleteAlarms",
          "cloudwatch:DeleteDashboards",
          "cloudwatch:DescribeAlarms",
          "cloudwatch:GetDashboard",
          "cloudwatch:ListDashboards",
          "cloudwatch:ListTagsForResource",
          "cloudwatch:PutDashboard",
          "cloudwatch:PutMetricAlarm",
          "cloudwatch:TagResource",
          "cloudwatch:UntagResource"
        ]
        Resource = "*"
      },
      {
        Sid    = "ManageObservabilityNotifications"
        Effect = "Allow"
        Action = [
          "sns:CreateTopic",
          "sns:DeleteTopic",
          "sns:GetSubscriptionAttributes",
          "sns:GetTopicAttributes",
          "sns:ListSubscriptionsByTopic",
          "sns:ListTagsForResource",
          "sns:SetTopicAttributes",
          "sns:Subscribe",
          "sns:TagResource",
          "sns:Unsubscribe",
          "sns:UntagResource"
        ]
        Resource = local.observability_sns_topic_arns
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

resource "aws_iam_role_policy_attachment" "github_apply_lobby" {
  role       = aws_iam_role.github_apply.name
  policy_arn = aws_iam_policy.github_apply_lobby.arn
}

resource "aws_iam_role_policy_attachment" "github_apply_observability" {
  role       = aws_iam_role.github_apply.name
  policy_arn = aws_iam_policy.github_apply_observability.arn
}
