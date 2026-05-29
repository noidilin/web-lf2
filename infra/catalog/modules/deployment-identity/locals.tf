data "aws_caller_identity" "current" {}

locals {
  lab_permissions_boundary_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/lab-devops-permissions-boundary"
}
