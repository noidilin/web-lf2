# Phase 2 — Deployment Inputs

Confirmed human-owned inputs for the Phase 2 AWS baseline. AFK agents should treat these as fixed and not guess alternatives.

## AWS Account & Region

| | Value |
|---|---|
| Account ID | `549475122024` |
| Region | `ap-northeast-1` |
| ACM exception | `us-east-1` (aliased provider for CloudFront certs only) |
| Remote state bucket | `noidilin-tf-state` |
| Remote state region | `ap-northeast-1` |
| State locking | DynamoDB via `use_lockfile = true` |

## Domain & TLS

| | Prod | Dev |
|---|---|---|
| **Game (CloudFront)** | `lf2.noidilin.dev` | `dev.lf2.noidilin.dev` |
| **Lobby (ALB)** | `lf2-lobby.noidilin.dev` | `dev.lf2-lobby.noidilin.dev` |
| Route 53 hosted zone | `noidilin.dev` — pre-existing in account |

ACM certificates for CloudFront must be created in `us-east-1`. Use an aliased provider in the static-site module:

```hcl
# infra/environments/{dev,prod}/static-site/terragrunt.hcl
generate "provider_us_east_1" {
  path      = "provider_us_east_1.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "aws" {
  region = "us-east-1"
  alias  = "us_east_1"
}
EOF
}
```

ACM certificates for the ALB (lobby) stay in `ap-northeast-1` with the default provider.

## IaC

| | Value |
|---|---|
| Tool | Terraform + Terragrunt |
| Project variable | `web-lf2` |
| Environment names | `dev`, `prod` |
| Naming prefix | `devops-web-lf2-${var.environment}` |
| Permissions boundary | `arn:aws:iam::549475122024:policy/lab-devops-permissions-boundary` |
| Boundary usage | Every `aws_iam_role` must set `permissions_boundary` |
| Boundary management | Pre-existing — do not create, update, or delete from lab Terraform |

### IAM naming rules

All Terraform-managed IAM resources must use one of these prefixes:

- `devops-*`
- `lab-*`
- `terraform-*`

Preferred role naming pattern:

```hcl
locals {
  name_prefix = "devops-web-lf2-${var.environment}"
}

# Example
name = "${local.name_prefix}-ecs-task-execution-role"
```

### Approved AWS managed policies for attachment

- `arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore`
- `arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy`
- `arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRoleforExpressGatewayServices`

### Terragrunt layout

```
root.hcl                          # remote_state, default provider
infra/
  modules/
    static-site/
    lobby-service/
    networking/
    observability/
  environments/
    dev/
      terragrunt.hcl
      static-site/terragrunt.hcl
      lobby-service/terragrunt.hcl
      networking/terragrunt.hcl
      observability/terragrunt.hcl
    prod/
      terragrunt.hcl
      static-site/terragrunt.hcl
      lobby-service/terragrunt.hcl
      networking/terragrunt.hcl
      observability/terragrunt.hcl
```

Each environment has its own state key: `infra/environments/{dev,prod}/terraform.tfstate`.

## GitHub Actions OIDC

This is the first GitHub Actions integration for the account.

### OIDC provider

- URL: `token.actions.githubusercontent.com`
- Repository: `noidilin/web-lf2`
- Created once per AWS account by the shared `github-oidc-provider` Terraform unit
- Reused by each environment's `deployment-identity` roles via provider lookup

### Roles

| Role | Name | Trust Condition | Purpose |
|---|---|---|---|
| Plan | `devops-web-lf2-{env}-github-plan` | `repo:noidilin/web-lf2:pull_request` | `terraform plan`, read state |
| Apply | `devops-web-lf2-{env}-github-apply` | `repo:noidilin/web-lf2:environment:{env}` | `terraform apply`, S3 sync, ECR push, ECS deploy |

Create one plan/apply pair per environment (`dev`, `prod`) so each environment can have independent permissions and state access.

Both roles:

- Carry `lab-devops-permissions-boundary`
- Use the shared account-level OIDC provider (no long-lived AWS keys)
- Follow the naming and boundary rules from `docs/IAMIC-permission-for-lab.md`

## Production Approval

| | Value |
|---|---|
| GitHub Environment | `prod` requires 1 reviewer |
| Reviewer | `noidilin` |
| Dev environment | No approval — deploys on merge to `main` |
| Environments in scope | `dev` and `prod` only (no staging in Phase 2) |

### Release flow

```
Pull Request
  -> CI
  -> terraform plan (using plan role)

Merge to main
  -> deploy dev (using apply role)
  -> smoke tests

Manual approval (prod environment)
  -> deploy prod (using apply role)
  -> smoke tests
```

## Quick reference

```
Account:         549475122024
Region:          ap-northeast-1
Project:         web-lf2
Domain:          noidilin.dev
Game subdomains: lf2 / dev.lf2
Lobby subdomains: lf2-lobby / dev.lf2-lobby
Environments:    dev, prod
IaC:             Terraform + Terragrunt
State bucket:    noidilin-tf-state
Boundary policy: lab-devops-permissions-boundary
```
