data "aws_caller_identity" "current" {}

locals {
  lab_gitops_oidc_apply_permissions_boundary_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/lab-gitops-oidc-apply-permissions-boundary"

  terraform_state_bucket_arn             = "arn:aws:s3:::noidilin-tf-state"
  terraform_state_environment_prefix     = "web-lf2/live/${var.environment}"
  terraform_state_environment_objects    = "${local.terraform_state_bucket_arn}/${local.terraform_state_environment_prefix}/*"
  terraform_state_environment_lock_files = "${local.terraform_state_bucket_arn}/${local.terraform_state_environment_prefix}/*/terraform.tfstate.tflock"

  static_site_bucket_name        = "${var.name_prefix}-static-assets"
  static_site_bucket_arn         = "arn:aws:s3:::${local.static_site_bucket_name}"
  static_site_bucket_objects_arn = "${local.static_site_bucket_arn}/*"

  lobby_ecr_repository_arn = "arn:aws:ecr:${var.aws_region}:${var.account_id}:repository/${var.name_prefix}-lobby"
  lobby_iam_roles_arn      = "arn:aws:iam::${var.account_id}:role/${var.name_prefix}-lobby-*"
}
