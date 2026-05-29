# ADR 001 — Infrastructure as Code baseline with Terragrunt stacks

**Status:** Accepted

**Context:** Issue #11 requires the IaC and GitHub OIDC baseline for all later Phase 2 AWS deployment slices. We need module boundaries, environment separation, and CI validation before building real infrastructure.

**Decision:**

Adopt the Terragrunt stack pattern from the `02-static-site` lab reference with five reusable modules and per-environment stack entry points.

Module boundaries:

| Module | Purpose |
|---|---|
| `deployment-identity` | GitHub Actions OIDC provider, plan and apply IAM roles |
| `networking` | VPC, subnets, route tables, security groups |
| `static-site` | S3 bucket, CloudFront, ACM (us-east-1), Route 53 |
| `lobby-service` | ECR, ECS Fargate, ALB, CloudWatch Logs, IAM roles |
| `observability` | CloudWatch dashboards, alarms, SNS notifications |

Layout:

```
infra/
  catalog/
    modules/          # Reusable Terraform modules
    units/            # Terragrunt unit wiring (remote_state + dependency)
  live/
    root.hcl          # Shared provider (ap-northeast-1)
    dev/terragrunt.stack.hcl
    prod/terragrunt.stack.hcl
```

Key conventions from `phase-2-deployment-inputs.md`:

- Naming: `devops-web-lf2-{env}-{resource}`
- Permissions boundary on every IAM role
- Remote state in `noidilin-tf-state` bucket with DynamoDB locking
- Separate plan (pull_request) and apply (main branch) OIDC roles

**Consequences:**

- Each module can be implemented independently by later issues
- PRs get automatic terraform plan via GitHub Actions OIDC
- No long-lived AWS credentials in CI
- Dev and prod share identical module interfaces with environment-specific values
