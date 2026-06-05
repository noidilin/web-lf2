# Phase 2 deployment and operations runbook

This runbook explains how to validate, deploy, smoke test, and operate the Phase 2 AWS baseline for `web-lf2`.

Phase 2 preserves the legacy `F.Lobby 0.1` browser contract while running the game as a production-style AWS deployment:

```txt
Players
  | HTTPS
  v
Route 53 game domain
  -> CloudFront
  -> private S3 bucket with Origin Access Control

Players
  | HTTPS / WSS
  v
Route 53 lobby domain
  -> public Application Load Balancer
  -> ECS Fargate service in private subnets
  -> F.Lobby container
```

## Environments

| Environment | Game URL | Lobby URL | AWS region | Notes |
|---|---|---|---|---|
| `dev` | `https://dev.lf2.noidilin.dev` | `https://dev.lf2-lobby.noidilin.dev` | `ap-northeast-1` | Deploys automatically on merge to `main` through `.github/workflows/deploy-dev.yml`. |
| `prod` | `https://lf2.noidilin.dev` | `https://lf2-lobby.noidilin.dev` | `ap-northeast-1` | Deployed manually through `.github/workflows/deploy-prod.yml`; the GitHub `prod` environment requires reviewer approval. |

CloudFront certificates are the exception: ACM resources for the static game distribution are managed in `us-east-1`.

## Prerequisites

Local validation and emergency operations expect:

- Node.js 22 for root tests and static artifact commands.
- Docker for local lobby contract tests.
- Terraform `>= 1.10` and Terragrunt `>= 0.95` for IaC validation and manual stack operations.
- AWS CLI authenticated to account `549475122024` with permission to inspect or operate the Phase 2 resources.
- GitHub Actions environments named `dev` and `prod` with OIDC access to the environment-specific apply roles.

Do not add long-lived AWS credentials to the repository or GitHub secrets. CI/CD uses GitHub Actions OIDC roles:

- `devops-web-lf2-{env}-github-plan` for pull request plans.
- `devops-web-lf2-{env}-github-apply` for environment deployment.

## Validate and plan infrastructure changes

Run these checks before opening or merging infrastructure changes:

```sh
# Terragrunt HCL formatting
terragrunt hcl format --check --diff --working-dir infra

# Terraform formatting for reusable modules
find infra/catalog/modules -name "*.tf" -exec terraform fmt -check -diff {} \;

# Validate an environment stack
cd infra/live/dev
terragrunt stack run validate --non-interactive

# Plan an environment stack, excluding deployment-identity unless intentionally updating CI IAM
terragrunt stack run plan --non-interactive --tf-forward-stdout \
  --queue-exclude-dir '.terragrunt-stack/deployment-identity' \
  --out-dir plan-out
```

Repeat the validate/plan commands from `infra/live/prod` for production-impacting changes.

Pull requests that change `infra/**` also run `.github/workflows/terraform-plan.yml`, which plans both `dev` and `prod` with the read-only plan roles and comments the plan output on the PR.

### Deployment identity updates

GitHub Actions should not normally update the role it is actively using. If `infra/catalog/modules/deployment-identity/**` changes, apply that unit locally with the AWS SSO/admin profile before relying on deploy workflows:

```sh
cd infra/live/dev
terragrunt stack run apply --non-interactive \
  --queue-include-dir '.terragrunt-stack/deployment-identity' \
  --queue-strict-include
```

Run the equivalent command in `infra/live/prod` when production deployment roles change.

## Deploy dev

The normal dev path is automatic:

1. Merge to `main`.
2. `.github/workflows/deploy-dev.yml` runs with concurrency group `deploy-dev`.
3. The workflow deploys in order:
   1. lobby networking/bootstrap/service;
   2. static game artifact and CloudFront invalidation;
   3. observability dashboard, alarms, and SNS topics.

You can also manually dispatch `Deploy Dev` from GitHub Actions.

### Dev lobby deployment details

`.github/workflows/deploy-lobby-dev.yml`:

1. Installs root and lobby dependencies.
2. Runs the Dockerized local lobby contract smoke and lobby hardening/infrastructure tests.
3. Assumes `devops-web-lf2-dev-github-apply` through OIDC.
4. Applies `networking` and `lobby-bootstrap`.
5. Builds the `apps/lobby` image, pushes `:${github.sha}` and `:latest` to ECR.
6. Applies `lobby-service`.
7. Forces a new ECS deployment and waits for service stability.
8. Runs `tests/deployed-lobby-contract.test.mjs` against the deployed lobby URL.

### Dev static deployment details

`.github/workflows/deploy-static-dev.yml`:

1. Reads `lobby-service.lobby_url` from Terragrunt outputs.
2. Builds `dist/static` with `LOBBY_BASE_URL` set to the deployed lobby URL.
3. Runs static artifact checks and static unit tests.
4. Applies `static-site`.
5. Syncs `dist/static/` to the private S3 bucket with `--delete`.
6. Invalidates CloudFront with path `/*`.
7. Waits for `/healthz` and `/protocol` on the deployed lobby.
8. Runs Playwright deployed smoke tests against the CloudFront game URL.

## Deploy prod

Production is intentionally manual:

1. Confirm dev has deployed successfully from the same commit or an equivalent commit.
2. Open GitHub Actions and dispatch `Deploy Prod`.
3. Approve the GitHub `prod` environment when prompted.
4. The workflow deploys lobby, static, and observability in the same order as dev, using `devops-web-lf2-prod-github-apply`.
5. Confirm deployed lobby contract and Playwright smoke jobs pass.

Standalone production workflows (`Deploy Lobby Prod`, `Deploy Static Site Prod`, and `Deploy Observability Prod`) are available for targeted recovery, but prefer the orchestrated `Deploy Prod` workflow for normal releases so the game artifact is built against the current deployed lobby URL.

## Local smoke tests

Run these from the repository root before deployment-impacting changes:

```sh
# Build the deterministic static game artifact
npm run build:static

# Validate deployed artifact shape and URL hygiene
npm run check:static

# Root Node test suite for static checks, workflows, infrastructure, and observability contracts
npm test

# Dockerized F.Lobby 0.1 endpoint contract smoke
npm run test:lobby

# Browser smoke tests against local static artifact and Dockerized lobby
npm run test:e2e
```

If `npm run test:lobby` leaves containers running after a failure, clean up with:

```sh
docker compose down --remove-orphans
```

## Deployed smoke tests

The deployment workflows run deployed smoke checks automatically. To rerun them locally after authenticating to AWS and retrieving outputs:

```sh
# Example: dev outputs
cd infra/live/dev
LOBBY_BASE_URL=$(terragrunt stack output --format raw lobby-service.lobby_url --non-interactive --queue-include-dir '.terragrunt-stack/lobby-service' --queue-strict-include)
GAME_URL=$(terragrunt stack output --format raw static-site.game_url --non-interactive --queue-include-dir '.terragrunt-stack/static-site' --queue-strict-include)
cd ../../..

# Lobby deployed contract: /protocol, /lobby, and legacy login response shape
LOBBY_BASE_URL="$LOBBY_BASE_URL" node --test tests/deployed-lobby-contract.test.mjs

# Game deployed smoke: CloudFront game loads and discovers the deployed lobby
PLAYWRIGHT_BASE_URL="$GAME_URL" \
LOBBY_BASE_URL="$LOBBY_BASE_URL" \
npx playwright test --config playwright.deployed.config.mjs
```

Quick manual probes:

```sh
curl -i "$LOBBY_BASE_URL/healthz"
curl -i "$LOBBY_BASE_URL/protocol"
curl -I "$GAME_URL/game/game.html"
```

Expected results:

- `/healthz` returns HTTP 200.
- `/protocol` returns the preserved `F.Lobby 0.1` protocol shape and public `https`/`wss` addresses.
- The game page returns through CloudFront over HTTPS.

## Operate the dashboard and alarms

The `observability` unit creates one dashboard per environment:

- `devops-web-lf2-dev-baseline`
- `devops-web-lf2-prod-baseline`

Open it in CloudWatch Dashboards in `ap-northeast-1`. CloudFront metrics on the dashboard are global metrics displayed from `us-east-1`.

Dashboard sections:

| Section | What to check |
|---|---|
| Baseline alarm status | First stop during incidents; shows whether any baseline alarm is firing. |
| CloudFront delivery | Static game request count, 4xx/5xx error rates, and cache hit ratio. |
| Lobby load balancer | ALB request volume, ALB-generated 4xx/5xx errors, and p95 target response time. |
| ECS runtime | F.Lobby CPU, memory, and Container Insights running task count. |
| Lobby availability | ALB healthy/unhealthy target counts for the lobby target group. |
| Recent structured lobby errors | CloudWatch Logs Insights table for warning/error lobby events. |

Baseline alarms:

| Alarm key | Meaning | First response |
|---|---|---|
| `cloudfront_5xx_rate` | Static game delivery is returning sustained CloudFront/origin 5xx errors. | Check recent static deploy, CloudFront distribution status, S3 bucket policy/OAC, and whether the origin object exists. |
| `alb_5xx_count` | The lobby ALB is returning server errors. | Check listener/target group health, recent ECS deployment events, and lobby logs. |
| `alb_unhealthy_targets` | One or more registered lobby targets failed health checks. | Inspect ECS task health, target group health checks, security groups, and `/healthz`. |
| `ecs_running_task_count` | ECS has fewer running tasks than the single-task baseline requires. Missing data is breaching. | Check ECS service events, task stopped reasons, image pull failures, IAM task execution role, and CPU/memory pressure. |
| `lobby_availability` | No healthy lobby target is available for HTTPS/WSS traffic. Missing data is breaching. | Treat as lobby outage; confirm ALB target health, ECS running task, and `/healthz`. |

Alarm notifications are sent through environment-specific SNS topics in `ap-northeast-1`; CloudFront alarm notifications use the `us-east-1` topic.

## Basic incident response

### Static game unavailable or stale

1. Check `cloudfront_5xx_rate` and CloudFront delivery widgets.
2. Confirm the static deployment job synced `dist/static/` and created a CloudFront invalidation.
3. Verify the object exists in the environment S3 bucket and direct public S3 access remains denied.
4. Rerun the relevant `Deploy Static Site {Dev,Prod}` workflow if the artifact or invalidation failed.
5. If prod is affected, validate dev first unless the incident requires immediate production recovery.

### Lobby unavailable

1. Check `lobby_availability`, `alb_unhealthy_targets`, and `ecs_running_task_count`.
2. Run `curl -i "$LOBBY_BASE_URL/healthz"` and `curl -i "$LOBBY_BASE_URL/protocol"`.
3. Inspect ECS service events for stopped tasks, image pull errors, failed health checks, or rollout failures.
4. Inspect the F.Lobby log group from the dashboard's Logs Insights widget.
5. Rerun the relevant `Deploy Lobby {Dev,Prod}` workflow to rebuild/push the image and force a new ECS deployment.

### Deployed game cannot discover lobby

1. Confirm the static workflow built with `LOBBY_BASE_URL` from the same environment's `lobby-service.lobby_url` output.
2. Confirm `/protocol` emits the public HTTPS/WSS lobby origin, not an internal ALB or task address.
3. Check allowed origins: dev game should only use `https://dev.lf2.noidilin.dev`; prod game should only use `https://lf2.noidilin.dev`.
4. Rerun deployed lobby contract and Playwright smoke tests.

## Completed portfolio architecture

The Phase 2 baseline demonstrates:

- deterministic static artifact build for the legacy RequireJS game;
- private S3 object storage behind CloudFront OAC and HTTPS-only viewer access;
- Route 53 and ACM-managed TLS for game and lobby domains;
- Dockerized `F.Lobby 0.1` service on ECS Fargate behind an ALB with HTTPS/WSS support;
- private ECS tasks with ALB-only ingress boundaries;
- Terraform/Terragrunt reusable modules with separate `dev` and `prod` stacks;
- GitHub Actions OIDC for plan/apply/deploy without long-lived AWS keys;
- deployment workflows for lobby, static game, and observability;
- deployed smoke tests for the lobby contract and game-to-lobby path;
- CloudWatch Logs, dashboard widgets, SNS-backed alarms, and baseline incident signals.

## Out of scope for Phase 2 follow-up

Do not treat these as runbook gaps; they are deliberate later-phase work:

- Redis or ElastiCache-backed room/session state.
- Horizontal lobby scaling beyond the safe single ECS task baseline.
- ECS autoscaling policies for the lobby.
- EKS/Kubernetes deployment.
- Full F.Lobby v2 rewrite or replacement of the `F.Lobby 0.1` protocol.
- React/Vite/Next.js frontend shell rewrite.
- Advanced application custom metrics beyond structured logs and AWS-managed metrics.
- WAF and analytics modernization unless added as small optional enhancements later.
