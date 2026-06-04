# Plan Phase 2 — AWS baseline deployment

## Goal

Deploy the stabilized legacy app to AWS using production-style infrastructure.

This phase creates the first complete cloud version: static frontend on S3/CloudFront and multiplayer lobby on ECS Fargate behind an Application Load Balancer.

## Scope

From the original modernization plan, this phase covers:

- Stage 5 — Lobby security hardening
- Stage 6 — AWS static frontend with S3 and CloudFront
- Stage 7 — AWS F.Lobby deployment on ECS Fargate
- Stage 8 — CI/CD for frontend and lobby
- Stage 9 — Environment separation, at least dev/prod basics
- Stage 10 — Observability v1

## Target architecture

```txt
Users
  |
  | HTTPS
  v
CloudFront
  |
  | Origin Access Control
  v
Private S3 bucket
  - static game artifact
  - RequireJS client
  - LF2 assets

Users
  |
  | HTTPS / WSS
  v
Route 53: lobby.example.com
  |
  v
Application Load Balancer
  |
  v
ECS Fargate service in private subnets
  |
  v
F.Lobby container
```

## Tasks

### 1. Infrastructure as Code

Use Terraform or OpenTofu.

Recommended layout:

```txt
infra/
  modules/
    static-site/
    lobby-service/
    networking/
    observability/
  environments/
    dev/
    prod/
```

Core infrastructure:

- VPC
- public subnets for ALB
- private subnets for ECS tasks
- S3 private bucket
- CloudFront distribution
- CloudFront Origin Access Control
- ACM certificates
- Route 53 records
- ECR repository
- ECS cluster
- ECS task definition
- ECS service
- ALB listener and target group
- CloudWatch log groups

### 2. Static frontend deployment

Implement:

- S3 bucket with public access blocked
- CloudFront distribution
- Origin Access Control
- HTTPS-only viewer policy
- cache policies
- CloudFront invalidation from CI/CD
- Playwright smoke tests against deployed URL

### 3. Lobby deployment on ECS Fargate

Implement:

- ECR repository
- Docker image build and push
- ECS task definition
- ECS service
- ALB HTTPS/WSS listener
- target group health check
- CloudWatch Logs integration
- `/health` endpoint

Initial ECS recommendation:

```txt
desiredCount = 1
cpu = 256 or 512
memory = 512 MiB or 1024 MiB
networkMode = awsvpc
platformVersion = LATEST
```

Important: keep `desiredCount = 1` until Redis-backed shared state exists. Current F.Lobby room and peer state is in memory.

### 4. Lobby security hardening

Add production configuration:

```txt
LOBBY_PUBLIC=false
LOBBY_ALLOWED_ORIGINS=https://game.example.com,https://staging.example.com
LOBBY_ROOM_TTL_SECONDS=3600
LOBBY_MAX_ROOM_USERS=50
LOBBY_RATE_LIMIT_WINDOW_SECONDS=60
LOBBY_RATE_LIMIT_MAX=120
```

Security tasks:

- restrict CORS to known game origins
- validate iframe/postMessage origins
- add rate limiting to `/login`
- add room cleanup/TTL
- add max WebSocket message size
- add graceful shutdown
- set `app.set('trust proxy', 1)` behind ALB
- ensure `/protocol` reports the correct HTTPS/WSS origin

### 5. CI/CD

Use GitHub Actions with AWS OIDC.

Recommended workflows:

```txt
.github/workflows/ci.yml
.github/workflows/terraform-plan.yml
.github/workflows/deploy-static.yml
.github/workflows/deploy-lobby-dev.yml
```

Static pipeline:

```txt
checkout
  -> build static artifact
  -> static checks
  -> Playwright local smoke
  -> Terraform/OpenTofu apply
  -> S3 sync
  -> CloudFront invalidation
  -> Playwright deployed smoke
```

Lobby pipeline:

```txt
checkout
  -> lobby tests
  -> docker build
  -> push to ECR
  -> deploy ECS task revision
  -> wait for service stability
  -> health check
  -> lobby integration tests
```

### 6. Observability v1

Add:

- structured JSON logs from F.Lobby
- CloudWatch log group retention
- CloudWatch dashboard
- CloudWatch alarms

Track:

- CloudFront requests, 4xx, 5xx, cache hit ratio
- ALB requests, 4xx, 5xx, target health
- ECS CPU and memory
- ECS task restarts
- lobby health check failures

## Acceptance criteria

- static game is available through CloudFront HTTPS
- S3 bucket is private
- lobby is reachable through ALB HTTPS/WSS
- deployed game can connect to deployed lobby
- CI/CD deploys static and lobby artifacts
- Terraform/OpenTofu plan runs on pull requests
- CloudWatch logs are available
- basic dashboard and alarms exist
- no long-lived AWS keys are used in GitHub Actions

## Portfolio value

This phase demonstrates:

- AWS architecture
- CDN and private object storage
- container deployment
- WebSocket service deployment
- TLS and DNS
- IaC
- GitHub Actions OIDC
- basic production operations

## Do not do yet

Avoid in this phase:

- EKS
- horizontal lobby scaling
- Redis migration unless necessary
- full F.Lobby v2 rewrite
- rewriting the game frontend in React
