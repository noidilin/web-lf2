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

dependency "static_site" {
  config_path = "../static-site"

  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
  mock_outputs = {
    cloudfront_distribution_id = "E0000000000000"
  }
}

dependency "lobby_service" {
  config_path = "../lobby-service"

  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
  mock_outputs = {
    alb_arn_suffix          = "app/devops-web-lf2-dev-lobby/0000000000000000"
    target_group_arn_suffix = "targetgroup/devops-web-lf2-dev-lobby/0000000000000000"
    ecs_cluster_name        = "devops-web-lf2-dev-lobby"
    ecs_service_name        = "devops-web-lf2-dev-lobby"
    log_group_name          = "/ecs/devops-web-lf2-dev-lobby"
  }
}

terraform {
  source = "${find_in_parent_folders("catalog/modules")}//observability"
}

inputs = {
  environment                = values.environment
  project                    = values.project
  name_prefix                = values.name_prefix
  aws_region                 = values.aws_region
  cloudfront_distribution_id = dependency.static_site.outputs.cloudfront_distribution_id
  alb_arn_suffix             = dependency.lobby_service.outputs.alb_arn_suffix
  target_group_arn_suffix    = dependency.lobby_service.outputs.target_group_arn_suffix
  ecs_cluster_name           = dependency.lobby_service.outputs.ecs_cluster_name
  ecs_service_name           = dependency.lobby_service.outputs.ecs_service_name
  lobby_log_group_name       = dependency.lobby_service.outputs.log_group_name
}
