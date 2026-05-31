# Infra

Terraform + Terragrunt infrastructure for the web-lf2 project.

## Layout

```
infra/
  catalog/
    modules/                   # Reusable Terraform modules
      github-oidc-provider/    # Account-level GitHub Actions OIDC provider
      deployment-identity/     # Environment GitHub Actions IAM roles
      networking/              # VPC, subnets, security groups
      static-site/             # S3 + CloudFront for the game frontend
      lobby-service/           # ECS Fargate + ALB for the lobby backend
      observability/           # CloudWatch logs, dashboards, alarms
    units/                     # Terragrunt unit wiring (one per module)
  live/
    root.hcl                   # Shared provider config
    shared/terragrunt.stack.hcl # Account/shared identity stack
    dev/terragrunt.stack.hcl    # Dev environment stack
    prod/terragrunt.stack.hcl   # Prod environment stack
```

See `docs/phase/phase-2-deployment-inputs.md` for account, region, naming, and domain configuration.

## Prerequisites

- Terraform >= 1.10
- Terragrunt >= 0.95
- AWS CLI configured with the lab Identity Center profile

## Local commands

```sh
# Format check
terragrunt hcl format --check --diff --working-dir infra

# Terraform format check
find infra/catalog/modules -name "*.tf" -exec terraform fmt -check -diff {} \;

# Validate a single environment
cd infra/live/dev && terragrunt stack run validate

# Plan
cd infra/live/dev && terragrunt stack run plan

# Bootstrap shared account identity once per AWS account
cd infra/live/shared && terragrunt stack run apply

# Apply an environment stack
cd infra/live/dev && terragrunt stack run apply
```

## GitHub Actions OIDC

This project uses GitHub Actions OIDC for AWS authentication — no long-lived keys.

### Roles

| Role | Name | Trust Condition | Purpose |
|---|---|---|---|
| Plan | `devops-web-lf2-{env}-github-plan` | `repo:noidilin/web-lf2:pull_request` | `terraform plan`, read state |
| Apply | `devops-web-lf2-{env}-github-apply` | `repo:noidilin/web-lf2:environment:{env}` | `terraform apply`, S3 sync, ECR push, ECS deploy |

Both roles carry `lab-devops-permissions-boundary`.

### Required GitHub configuration

**No secrets needed.** The workflow uses `aws-actions/configure-aws-credentials` with OIDC.

**Required GitHub Environments:**
- `dev` — no approval required, deploys on merge to `main`
- `prod` — requires 1 reviewer (`noidilin`)

Create these environments in GitHub repo Settings > Environments.

### OIDC provider

Created once per AWS account by the `github-oidc-provider` shared unit. Environment `deployment-identity` modules look up that provider and create repository-scoped plan/apply roles for `noidilin/web-lf2`.

## IAM conventions

All IAM roles and policies follow the lab naming and boundary rules:

- Names prefixed with `devops-`, `lab-`, or `terraform-`
- Every role has `permissions_boundary` set to `lab-devops-permissions-boundary`
- Boundary policy is pre-existing — never modified by project Terraform
- See `docs/IAMIC-permission-for-lab.md` in the devops docs for full rules

## Module status

| Module | Status | Description |
|---|---|---|
| github-oidc-provider | **Ready** | Account-level GitHub Actions OIDC provider |
| deployment-identity | **Ready** | Environment plan/apply roles trusting shared OIDC provider |
| networking | Placeholder | VPC layout will be added in a later issue |
| static-site | **Implemented** | Private S3 bucket + CloudFront CDN with OAC, ACM (us-east-1), Route 53 alias, cache policy, HTTPS-only |
| lobby-service | Placeholder | ECS Fargate + ALB will be added in a later issue |
| observability | Placeholder | CloudWatch will be added in a later issue |
