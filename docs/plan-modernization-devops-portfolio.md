# Modernization and DevOps plan

## Phase breakdown

This plan has been split into timeline-based phase documents:

```txt
docs/plan-phase-1-stabilize-legacy-app.md
docs/plan-phase-2-aws-baseline.md
docs/plan-phase-3-modern-frontend-shell.md
docs/plan-phase-4-backend-scalability.md
docs/plan-phase-5-kubernetes-capstone.md
```

Recommended order:

```txt
Phase 1 — Stabilize legacy app
Phase 2 — AWS baseline deployment
Phase 3 — Modern frontend shell with Vite and React
Phase 4 — Backend scalability and F.Lobby modernization
Phase 5 — Kubernetes/EKS capstone
```


## Project snapshot

This repository is a legacy browser game plus its original multiplayer lobby service:

```txt
apps/game/    RequireJS/AMD HTML5 game client, formerly F.LF
assets/       LF2 1.9 game data, sprites, sounds, UI assets, formerly LF2_19
apps/lobby/   legacy PvP lobby/chat/transport server, formerly F.Lobby
```

Important current constraints:

- The game is not an npm/ESM app. It is a static RequireJS application.
- The client now loads the asset package from `../../assets` when served from `/apps/game/game/game.html`.
- The old `LF2_19` source directory has been renamed to root `assets/`; asset-internal paths remain package-relative.
- Multiplayer is already integrated with **F.Lobby 0.1**, not a generic WebSocket relay.
- F.Lobby exposes a compatibility contract used by `apps/game/LF/manager.js`:
  - `GET /protocol`
  - `GET /lobby`
  - `POST /login`
  - `WS /chat`
  - `WS /peer` for WebSocket transport
  - optional PeerJS transport
  - iframe `postMessage` handshake with `protocol: "F.Lobby 0.1"`
- F.Lobby is very old:
  - Node engine `^0.10.25`
  - old Express, ws, PeerJS, optimist dependencies
  - public-mode/whitelist security model
  - HTTP jQuery CDN in `public/lobby.html`
- Some frontend assets and links still use old HTTP or protocol-relative URLs.
- The game injects browser analytics in `apps/game/game/game.js` when served over HTTP(S).

## Strategy

Modernize in layers while preserving gameplay compatibility.

The key decision is:

> Do not replace F.Lobby with a generic WebSocket relay early. First make the existing F.Lobby contract reproducible, tested, containerized, and deployable. Then modernize or replace it behind the same external protocol.

This gives a safer and more coherent portfolio story:

> Cloud modernization of a legacy HTML5 multiplayer game: static CDN frontend, compatible lobby backend, CI/CD, browser tests, observability, and later scalable multiplayer infrastructure.

---

# DONE Stage 0 — Local baseline and repository normalization

---

# Stage 1 — Static artifact build

## Goal

Create a deterministic deployable frontend artifact instead of relying on fragile sibling folders.

## Target output

```txt
dist/static/
  game/
  LF/
  core/
  third_party/
  LF2_19/
```

## Tasks

- Add a build script that copies `flf` and `lf2_19` into `dist/static`.
- Canonicalize the deployed asset directory as `LF2_19` unless the app config is changed everywhere.
- Preserve the existing game config initially:

```json
{"root":"../","package":"../LF2_19"}
```

- Add static checks for:
  - required files exist
  - no missing package directory
  - unexpected `http://` references
  - protocol-relative URLs like `//...`
  - valid embedded game config

## Suggested files

```txt
scripts/build-static.mjs
scripts/check-static.mjs
dist/static/       # generated, not hand-edited
```

## Value

Makes S3, CloudFront, Docker, and browser tests predictable.

## Risk

Low to medium.

---

# Stage 2 — Playwright smoke and integration tests

## Goal

Add a safety net before modernizing legacy code.

## Tests

Static frontend:

- `/game/game.html` loads.
- main game root/UI appears.
- canvas or renderer element exists.
- no fatal console errors.
- screenshot artifact is saved.

Lobby backend:

- `GET /protocol` returns valid JSON.
- `GET /lobby` returns HTML.
- `POST /login` validates room/name behavior.

Integration:

- game opens network game screen.
- game can request `/protocol` from local lobby.
- lobby iframe loads from local lobby origin.

## Suggested files

```txt
playwright.config.ts
tests/game-smoke.spec.ts
tests/lobby-smoke.spec.ts
tests/integration-network-menu.spec.ts
```

## Value

Enables safe dependency upgrades and cloud deployment validation.

## Risk

Low to medium. Legacy apps may emit harmless warnings that need filtering.

---

# Stage 3 — Containerize F.Lobby as-is

## Goal

Make the existing multiplayer service reproducible before changing it.

## Tasks

- Add a Dockerfile for `F.Lobby`.
- Add Docker Compose for local static frontend + lobby.
- Prefer a compatibility image if old dependencies do not install cleanly on modern Node.
- Keep all public endpoints unchanged.

## Suggested files

```txt
F.Lobby/Dockerfile
F.Lobby/.dockerignore
compose.yaml
```

## Value

Turns a fragile legacy Node service into a deployable artifact.

## Risk

Medium because old npm dependencies may require runtime compatibility work.

---

# Stage 4 — Incrementally modernize F.Lobby

## Goal

Upgrade the lobby service without breaking the F.Lobby 0.1 browser contract.

## Compatibility endpoints to preserve

```txt
GET  /protocol
GET  /lobby
POST /login
WS   /chat
WS   /peer
```

## Upgrade order

1. Move to current Node LTS.
2. Replace `optimist` with `yargs` or environment-based config.
3. Upgrade Express.
4. Upgrade `ws`.
5. Replace `body-parser` usage with `express.json()`.
6. Remove HTTP jQuery CDN dependency from `public/lobby.html`.
7. Add `GET /health`.
8. Add structured logging.
9. Add unit/integration tests around login, chat, protocol, and peer signaling.

## Avoid early

- TypeScript rewrite.
- React/Next.js lobby UI rewrite.
- Changing the game-facing protocol.
- Replacing peer/session semantics before tests exist.

## Value

Reduces security and runtime risk while maintaining compatibility.

## Risk

Medium.

---

# Stage 5 — Lobby security hardening

## Goal

Make F.Lobby safe enough to expose behind HTTPS/WSS.

## Current risks

- Global permissive CORS.
- Dangerous `--public` mode.
- Static JSON whitelist/blacklist only.
- In-memory rooms without TTL or limits.
- No rate limiting.
- Weak origin handling.
- No production health/readiness endpoints.

## Tasks

- Add explicit configuration:

```txt
LOBBY_PUBLIC=false
LOBBY_ALLOWED_ORIGINS=https://example.com,https://staging.example.com
LOBBY_ROOM_TTL_SECONDS=3600
LOBBY_MAX_ROOM_USERS=50
LOBBY_RATE_LIMIT_WINDOW_SECONDS=60
LOBBY_RATE_LIMIT_MAX=120
```

- Restrict CORS and iframe origins.
- Add rate limiting for `/login`.
- Add room cleanup/TTL.
- Add max message size.
- Add graceful shutdown.
- Add proxy awareness for ALB/CloudFront:

```js
app.set('trust proxy', 1)
```

- Ensure `/protocol` returns correct HTTPS origin behind a load balancer.

## Value

Needed before real internet exposure.

## Risk

Medium.

---

# Stage 6 — AWS static frontend with S3 and CloudFront

## Goal

Deploy the static game to production-style hosting.

## Architecture

```txt
Browser
  -> CloudFront HTTPS
      -> private S3 bucket
          -> static game artifact
```

## Tasks

- Create S3 bucket with public access blocked.
- Use CloudFront Origin Access Control.
- Add ACM certificate and optional Route 53 custom domain.
- Add cache policies.
- Add CI cache invalidation.
- Run Playwright against the CloudFront URL.

## Suggested IaC

```txt
infra/
  modules/static-site/
  environments/dev/
  environments/prod/
```

## Value

Core DevOps portfolio milestone: CDN, HTTPS, private S3, IaC.

## Risk

Medium.

---

# Stage 7 — AWS F.Lobby deployment on ECS Fargate

## Goal

Deploy the compatible multiplayer lobby backend.

## Architecture

```txt
Browser
  -> CloudFront static game

Browser
  -> ALB HTTPS/WSS
      -> ECS Fargate service
          -> F.Lobby container
```

## Tasks

- Create ECR repository.
- Create ECS cluster, task definition, and service.
- Put ALB in front of the service.
- Enable WebSocket support through ALB.
- Configure HTTPS certificate.
- Send container logs to CloudWatch Logs.
- Expose:

```txt
https://lobby.example.com/protocol
https://lobby.example.com/lobby
wss://lobby.example.com/chat
wss://lobby.example.com/peer
```

- Update default game lobby server from old Project F URL to environment-configured lobby URL.

## Value

Restores multiplayer under your own cloud infrastructure.

## Risk

Medium to high because WebSocket behavior and origin handling must be correct.

---

# Stage 8 — CI/CD for frontend and lobby

## Goal

Automate repeatable deployment of both artifacts.

## Workflows

```txt
.github/workflows/ci.yml
.github/workflows/deploy-static-dev.yml
.github/workflows/deploy-lobby-dev.yml
.github/workflows/terraform-plan.yml
```

## Static pipeline

```txt
checkout
  -> install tools
  -> build static artifact
  -> static checks
  -> Playwright local smoke
  -> Terraform/OpenTofu apply
  -> S3 sync
  -> CloudFront invalidation
  -> Playwright deployed smoke
```

## Lobby pipeline

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

## Security

- Use GitHub Actions OIDC for AWS access.
- Avoid long-lived AWS keys.
- Separate dev/prod environments with approvals for prod.
- Later ECR hardening: switch lobby image deploys from mutable `:latest` to SHA-only task-definition images, then set the lobby ECR repository to `IMMUTABLE` tags for stronger provenance and rollback guarantees.

## Value

Strong portfolio signal: IaC + CI/CD + browser validation + container deployment.

## Risk

Medium.

---

# Stage 9 — Environment separation

## Goal

Support dev/staging/prod deployment discipline.

## Structure

```txt
infra/environments/
  dev/
  staging/
  prod/
```

## Flow

```txt
Pull request
  -> checks
  -> Terraform plan

Merge to main
  -> deploy dev/staging
  -> run tests

Manual approval
  -> deploy prod
```

## Environment-specific config

- static CloudFront domain
- lobby HTTPS/WSS URL
- allowed origins
- analytics enabled/disabled
- logging verbosity

## Value

Professional release workflow.

## Risk

Medium, mostly operational complexity.

---

# Stage 10 — Observability v1

## Goal

Make the deployment operable.

## Static frontend metrics

- CloudFront request count
- CloudFront 4xx/5xx
- cache hit ratio
- origin latency

## Lobby metrics/logs

- ECS CPU/memory
- ECS task restarts
- ALB target health
- ALB 4xx/5xx
- active WebSocket connections
- room count
- message count
- login failures
- peer disconnects

## Tasks

- Emit structured JSON logs from F.Lobby.
- Create CloudWatch Log Groups with retention.
- Create CloudWatch dashboard.
- Add CloudWatch alarms.
- Optional SNS email notifications.

## Value

Shows operational readiness, not just deployment.

## Risk

Medium.

---

# Stage 11 — Observability v2 and custom metrics

## Goal

Add application-level multiplayer visibility.

## Tasks

- Add custom CloudWatch metrics:

```txt
LobbyActiveConnections
LobbyRooms
LobbyMessages
LobbyErrors
LobbyLoginFailures
```

- Add correlation/request IDs where useful.
- Add OpenTelemetry only after structured logs and basic metrics are stable.

## Value

Advanced backend operations story.

## Risk

Medium.

---

# Stage 12 — F.Lobby v2 compatibility replacement

## Goal

Build a cleaner implementation while keeping the current browser contract.

## Recommended approach

Implement a new service behind the same external API:

```txt
GET  /protocol
GET  /lobby
POST /login
WS   /chat
WS   /peer
```

Maintain this behavior:

- iframe lobby handshake
- `event: start` message shape
- `server.library` dynamic transport loading
- active/passive role assignment
- `id1`/`id2` peer identifiers

## Options

### Option A — Preserve F.Lobby 0.1 exactly

Lowest risk.

### Option B — New backend, old frontend API

Best long-term balance.

### Option C — New game networking API

Highest risk. Only consider after extensive tests and protocol documentation.

## Value

Real modernization without forcing a game client rewrite.

## Risk

High.

---

# Stage 13 — Redis-backed scaling

## Goal

Prepare lobby for multiple backend replicas.

## Why

Current F.Lobby stores rooms and peers in process memory. Multiple ECS tasks will not share room state.

## Architecture

```txt
ALB
  -> ECS Fargate tasks
      -> Redis / ElastiCache
```

## Tasks

- Use Redis for room metadata.
- Use Redis pub/sub for cross-instance chat/signaling.
- Add sticky-session analysis for WebSockets.
- Add reconnect behavior only if needed.

## Value

Scalable multiplayer systems design.

## Risk

High.

---

# Stage 14 — Kubernetes/EKS capstone

## Goal

Optionally migrate backend workloads to Kubernetes as an advanced capstone.

## Suggested path

Start local:

```txt
kind/minikube
  -> lobby deployment
  -> service
  -> ingress
  -> Redis
```

Then AWS:

```txt
CloudFront static frontend
  -> ALB Ingress / AWS Load Balancer Controller
      -> EKS lobby pods
          -> Redis / ElastiCache
```

## Tasks

- Kubernetes manifests or Helm chart.
- ExternalDNS/cert-manager if using custom domains.
- HPA.
- Pod disruption budgets.
- Container observability.

## Value

Advanced portfolio milestone.

## Risk

Very high. Do not start here.

---

# Recommended milestone packaging

## Milestone 1 — Legacy app baseline

```txt
local game + local F.Lobby + documented multiplayer contract
```

## Milestone 2 — Static deployment foundation

```txt
build artifact + checks + Playwright + S3/CloudFront
```

## Milestone 3 — Compatible lobby container

```txt
F.Lobby container + health checks + integration tests
```

## Milestone 4 — Cloud multiplayer restoration

```txt
ECS Fargate + ALB HTTPS/WSS + game connects to your lobby
```

## Milestone 5 — Production operations

```txt
CI/CD + environments + dashboards + alarms
```

## Milestone 6 — Scalable modernization

```txt
F.Lobby v2 + Redis-backed scaling
```

## Milestone 7 — Kubernetes capstone

```txt
EKS/Helm/Ingress migration
```

---

# Near-term recommendation

For the first complete portfolio version, stop at Stage 8 or Stage 10:

```txt
0. local baseline
1. static artifact
2. Playwright tests
3. F.Lobby container
4. F.Lobby dependency/security modernization
5. S3 + CloudFront static frontend
6. ECS Fargate lobby
7. CI/CD
8. basic observability
```

That is already a complete real-world modernization project. Redis, F.Lobby v2, and Kubernetes should be treated as advanced follow-up work.
