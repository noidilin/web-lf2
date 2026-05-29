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
    key          = "web-lf2/shared/github-oidc-provider/terraform.tfstate"
    region       = values.aws_region
    encrypt      = true
    use_lockfile = true
  }
}

terraform {
  source = "${find_in_parent_folders("catalog/modules")}//github-oidc-provider"
}

inputs = {
  project = values.project
}
