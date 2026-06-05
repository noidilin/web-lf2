locals {
  environment     = "dev"
  project         = "web-lf2"
  name_prefix     = "devops-web-lf2-dev"
  aws_region      = "ap-northeast-1"
  account_id      = "549475122024"
  lobby_image_tag = get_env("LOBBY_IMAGE_TAG", "sha-0000000000000000000000000000000000000000")
  units_path      = find_in_parent_folders("catalog/units")

  # Domain configuration
  hosted_zone_name = "noidilin.dev"
  game_domain      = "dev.lf2.noidilin.dev"
  lobby_domain     = "dev.lf2-lobby.noidilin.dev"
  allowed_origins  = "https://${local.game_domain}"

  # VPC configuration
  vpc_cidr = "10.0.0.0/16"
  azs      = ["ap-northeast-1a", "ap-northeast-1c"]
}

unit "networking" {
  source = "${local.units_path}/networking"
  path   = "networking"

  values = {
    environment = local.environment
    project     = local.project
    name_prefix = local.name_prefix
    aws_region  = local.aws_region
    vpc_cidr    = local.vpc_cidr
    azs         = local.azs
  }
}

unit "deployment-identity" {
  source = "${local.units_path}/deployment-identity"
  path   = "deployment-identity"

  values = {
    environment = local.environment
    project     = local.project
    name_prefix = local.name_prefix
    aws_region  = local.aws_region
    account_id  = local.account_id
    github_repo = "noidilin/web-lf2"
  }
}

unit "static-site" {
  source = "${local.units_path}/static-site"
  path   = "static-site"

  values = {
    environment      = local.environment
    project          = local.project
    name_prefix      = local.name_prefix
    aws_region       = local.aws_region
    account_id       = local.account_id
    hosted_zone_name = local.hosted_zone_name
    game_domain      = local.game_domain
  }
}

unit "lobby-bootstrap" {
  source = "${local.units_path}/lobby-bootstrap"
  path   = "lobby-bootstrap"

  values = {
    environment = local.environment
    project     = local.project
    name_prefix = local.name_prefix
    aws_region  = local.aws_region
  }
}

unit "lobby-service" {
  source = "${local.units_path}/lobby-service"
  path   = "lobby-service"

  values = {
    environment      = local.environment
    project          = local.project
    name_prefix      = local.name_prefix
    aws_region       = local.aws_region
    account_id       = local.account_id
    hosted_zone_name = local.hosted_zone_name
    allowed_origins  = local.allowed_origins
    lobby_domain     = local.lobby_domain
    image_tag        = local.lobby_image_tag
  }
}

unit "observability" {
  source = "${local.units_path}/observability"
  path   = "observability"

  values = {
    environment = local.environment
    project     = local.project
    name_prefix = local.name_prefix
    aws_region  = local.aws_region
  }
}
