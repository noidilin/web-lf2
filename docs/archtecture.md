# Cloud architecture design

## Goal

Modernize the legacy browser game and F.Lobby multiplayer service into a production-style cloud deployment while preserving the existing `F.Lobby 0.1` browser contract.

The architecture should showcase DevOps skills in:

- static artifact delivery
- CDN and TLS configuration
- containerization
- WebSocket backend deployment
- infrastructure as code
- CI/CD automation
- cloud observability
- security hardening
- environment separation

## Recommended target architecture

```txt
Users
  |
  | HTTPS
  v
Route 53: game.example.com
  |
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
Public Application Load Balancer
  |
  v
ECS Fargate service in private subnets
  |
  v
F.Lobby container
  - GET  /protocol
  - GET  /lobby
  - POST /login
  - WS   /chat
  - WS   /peer

Supporting services:
  - ECR for container images
  - CloudWatch Logs, Metrics, Dashboards, and Alarms
  - ACM for TLS certificates
  - GitHub Actions OIDC for AWS authentication
  - Terraform/OpenTofu for infrastructure as code
```

## AWS services

### Static frontend

Use:

- Amazon S3 private bucket
- Amazon CloudFront
- CloudFront Origin Access Control
- AWS Certificate Manager
- Route 53

The game is currently a static RequireJS application, so S3 and CloudFront are the best fit. Avoid hosting the static game from ECS or rewriting it into a modern frontend framework early.

### Lobby backend

Use:

- Amazon ECR
- Amazon ECS on Fargate
- Application Load Balancer
- CloudWatch Logs
- CloudWatch Metrics and Alarms

The lobby should stay behind the same external compatibility contract:

```txt
GET  /protocol
GET  /lobby
POST /login
WS   /chat
WS   /peer
```

Run the first cloud version with `desiredCount = 1` because current F.Lobby room and peer state is in memory. Horizontal scaling should wait until Redis-backed shared state is added.

### Networking

Recommended VPC layout:

```txt
VPC
  public subnets
    - Application Load Balancer
    - NAT Gateway, optional if not using VPC endpoints

  private subnets
    - ECS Fargate tasks

  VPC endpoints, recommended
    - ECR API interface endpoint
    - ECR DKR interface endpoint
    - S3 gateway endpoint
    - CloudWatch Logs interface endpoint
    - SSM and SSM Messages endpoints if ECS Exec is enabled
```

For a portfolio deployment, VPC endpoints are a strong addition because they show private networking maturity. A NAT Gateway is simpler but costs more and is less precise.

## Recommended tech stack

### Application

- Node.js LTS for the modernized lobby
- Express
- `ws`
- Docker
- `pino` or equivalent structured JSON logger
- `helmet`
- `express-rate-limit`
- environment-based configuration validation

Avoid early:

- TypeScript rewrite
- React/Next.js lobby UI rewrite
- changing the game-facing F.Lobby protocol
- replacing F.Lobby with a generic WebSocket relay

### Infrastructure

- Terraform or OpenTofu
- reusable modules under `infra/modules/`
- separate environments under `infra/environments/`

Suggested layout:

```txt
infra/
  modules/
    static-site/
    lobby-service/
    networking/
    observability/
  environments/
    dev/
    staging/
    prod/
```

Terraform/OpenTofu is recommended for the portfolio because it is widely recognized in DevOps roles.

### CI/CD

Use GitHub Actions with OIDC-based AWS access.

Recommended workflows:

```txt
.github/workflows/ci.yml
.github/workflows/terraform-plan.yml
.github/workflows/deploy-static.yml
.github/workflows/deploy-lobby.yml
```

Static deployment flow:

```txt
checkout
  -> build static artifact
  -> run static checks
  -> run Playwright local smoke tests
  -> Terraform/OpenTofu apply
  -> sync artifact to S3
  -> invalidate CloudFront
  -> run Playwright deployed smoke tests
```

Lobby deployment flow:

```txt
checkout
  -> run lobby tests
  -> build Docker image
  -> push image to ECR
  -> update ECS task definition
  -> deploy ECS service
  -> wait for service stability
  -> run health and integration tests
```

Security requirements:

- use GitHub Actions OIDC, not long-lived AWS keys
- separate IAM roles for plan/apply/deployment
- require manual approval for production
- use least-privilege permissions

## Observability

### Platform metrics

Track:

- CloudFront request count
- CloudFront 4xx and 5xx errors
- CloudFront cache hit ratio
- ALB request count
- ALB 4xx and 5xx errors
- ALB target health
- ECS CPU and memory usage
- ECS task restarts

### Application metrics

Add custom lobby metrics after basic structured logging is stable:

```txt
LobbyActiveConnections
LobbyRooms
LobbyMessages
LobbyErrors
LobbyLoginFailures
```

### Logging

Use structured JSON logs from the lobby service and send them to CloudWatch Logs with retention configured.

Useful log fields:

- timestamp
- level
- request ID
- event type
- room ID
- connection ID
- player name, if safe
- origin
- error code

### Alarms

Recommended alarms:

- CloudFront 5xx rate above threshold
- ALB 5xx rate above threshold
- unhealthy ALB targets
- ECS service running task count below desired count
- ECS CPU or memory sustained high usage
- lobby login failures above threshold
- no healthy lobby targets

## Security design

### Static site

- block all public S3 access
- use CloudFront Origin Access Control
- use HTTPS-only viewer policy
- configure secure response headers
- optionally add AWS WAF to CloudFront

### Lobby service

- expose only through ALB HTTPS/WSS
- restrict CORS to known game origins
- validate iframe/postMessage origins
- disable unsafe public mode in production
- add rate limiting to `/login`
- set max WebSocket message size
- add room TTL and cleanup
- configure graceful shutdown
- use `app.set('trust proxy', 1)` behind ALB

### Optional WAF

AWS WAF can be attached to CloudFront and optionally to the ALB. Use managed rule groups and basic rate limiting as a portfolio-friendly security enhancement.

## ECS deployment notes

For the first production-style deployment:

```txt
desiredCount = 1
cpu = 256 or 512
memory = 512 MiB or 1024 MiB
networkMode = awsvpc
platformVersion = LATEST
```

Important ECS settings:

- enable deployment circuit breaker with rollback
- set health check grace period
- reduce ALB target deregistration delay to 30-60 seconds
- use private subnets for Fargate tasks
- allow inbound task traffic only from the ALB security group
- write logs to CloudWatch Logs
- separate ECS execution role from task role

## Environment strategy

Use three environments if possible:

```txt
dev
staging
prod
```

Suggested release flow:

```txt
Pull request
  -> CI
  -> Terraform/OpenTofu plan

Merge to main
  -> deploy dev or staging
  -> run smoke tests

Manual approval
  -> deploy prod
  -> run deployed smoke tests
```

Environment-specific configuration:

- game CloudFront domain
- lobby HTTPS/WSS URL
- allowed origins
- analytics enabled or disabled
- logging verbosity
- rate limits

## Roadmap fit

### First portfolio version

Build through this target:

```txt
1. deterministic static artifact
2. Playwright smoke tests
3. Dockerized F.Lobby
4. S3 + CloudFront deployment
5. ECS Fargate + ALB WebSocket lobby
6. GitHub Actions CI/CD
7. CloudWatch logs, dashboard, and alarms
```

This is enough for a complete DevOps modernization story.

### Advanced follow-up

After the first version is stable:

```txt
1. F.Lobby v2 behind the same protocol
2. Redis or ElastiCache-backed room/session state
3. multiple ECS tasks
4. autoscaling
5. Kubernetes/EKS capstone, optional
```

Do not start with EKS. Keep Kubernetes as a later capstone after ECS, observability, and CI/CD are already working.

## Portfolio summary

This project can be presented as:

> Modernized a legacy HTML5 multiplayer game into a cloud-native deployment using S3, CloudFront, ECS Fargate, ALB WebSockets, GitHub Actions OIDC, Terraform/OpenTofu, Playwright tests, and CloudWatch observability while preserving the original multiplayer protocol.
