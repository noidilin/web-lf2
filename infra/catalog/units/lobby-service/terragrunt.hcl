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

dependency "networking" {
  config_path = "../networking"

  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
  mock_outputs = {
    vpc_id                = "vpc-00000000000000000"
    public_subnet_ids     = ["subnet-00000000000000001", "subnet-00000000000000002"]
    private_subnet_ids    = ["subnet-00000000000000003", "subnet-00000000000000004"]
    alb_security_group_id = "sg-00000000000000001"
    ecs_security_group_id = "sg-00000000000000002"
  }
}

terraform {
  source = "${find_in_parent_folders("catalog/modules")}//lobby-service"
}

inputs = {
  environment           = values.environment
  project               = values.project
  name_prefix           = values.name_prefix
  aws_region            = values.aws_region
  account_id            = values.account_id
  hosted_zone_name      = values.hosted_zone_name
  lobby_domain          = values.lobby_domain
  allowed_origins       = "https://${values.game_domain}"
  vpc_id                = dependency.networking.outputs.vpc_id
  public_subnet_ids     = dependency.networking.outputs.public_subnet_ids
  private_subnet_ids    = dependency.networking.outputs.private_subnet_ids
  alb_security_group_id = dependency.networking.outputs.alb_security_group_id
  ecs_security_group_id = dependency.networking.outputs.ecs_security_group_id
}
