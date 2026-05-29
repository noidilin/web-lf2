locals {
  project    = "web-lf2"
  aws_region = "ap-northeast-1"
  units_path = find_in_parent_folders("catalog/units")
}

unit "github-oidc-provider" {
  source = "${local.units_path}/github-oidc-provider"
  path   = "github-oidc-provider"

  values = {
    project    = local.project
    aws_region = local.aws_region
  }
}
