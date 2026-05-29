include "root" {
  path = find_in_parent_folders("root.hcl")
}

remote_state {
  backend = "s3"

  generate = {
    path      = "backend.tf"
    if_exists = "overwrite"
  }

  config = {
    bucket       = "noidilin-tf-state"
    key          = "web-lf2/live/${values.environment}/${basename(get_terragrunt_dir())}/terraform.tfstate"
    region       = values.aws_region
    encrypt      = true
    use_lockfile = true
  }
}

terraform {
  source = "${find_in_parent_folders("catalog/modules")}//static-site"
}

inputs = {
  environment      = values.environment
  project          = values.project
  name_prefix      = values.name_prefix
  aws_region       = values.aws_region
  account_id       = values.account_id
  hosted_zone_name = values.hosted_zone_name
  game_domain      = values.game_domain
  force_destroy    = true
}
