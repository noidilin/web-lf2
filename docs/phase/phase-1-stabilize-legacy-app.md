# Plan Phase 1 — Stabilize the legacy app

## Goal

Create a reproducible local baseline for the legacy game and F.Lobby service before making risky modernization changes.

This phase protects the original gameplay and multiplayer behavior while adding build, test, and container foundations.

## Scope

From the original modernization plan, this phase covers:

- Stage 1 — Static artifact build
- Stage 2 — Playwright smoke and integration tests
- Stage 3 — Containerize F.Lobby as-is
- early parts of Stage 4 only when needed for container/test stability

## Target outcome

```txt
local developer machine
  -> deterministic static artifact in dist/static
  -> local static server
  -> Dockerized F.Lobby
  -> Playwright smoke/integration tests
  -> documented F.Lobby 0.1 compatibility contract
```

## Tasks

### 1. Static artifact build

Create a deterministic deployable frontend artifact.

Target output:

```txt
dist/static/
  game/
  LF/
  core/
  third_party/
  LF2_19/
```

Recommended files:

```txt
scripts/build-static.mjs
scripts/check-static.mjs
```

Build script responsibilities:

- copy the RequireJS game client into `dist/static`
- copy root `assets/` into deployed package directory
- preserve compatibility with current game asset path expectations
- fail fast on missing required files

Static checks:

- required files exist
- game config points to the deployed asset package
- no unexpected `http://` references
- no protocol-relative URLs like `//example.com`
- no missing package directory

### 2. Playwright smoke tests

Add browser tests before modernizing legacy code.

Recommended files:

```txt
playwright.config.ts
tests/game-smoke.spec.ts
tests/lobby-smoke.spec.ts
tests/integration-network-menu.spec.ts
```

Test coverage:

- game page loads
- main UI/root element appears
- canvas or renderer element exists
- no fatal console errors
- screenshot artifact is saved
- `GET /protocol` returns valid JSON
- `GET /lobby` returns HTML
- `POST /login` validates room/name behavior
- game can open the network menu
- game can reach local lobby protocol endpoint

### 3. Containerize F.Lobby as-is

Create a reproducible lobby container while preserving the legacy protocol.

Recommended files:

```txt
apps/lobby/Dockerfile
apps/lobby/.dockerignore
compose.yaml
```

Requirements:

- keep all existing endpoints unchanged
- keep `F.Lobby 0.1` protocol string unchanged
- prefer compatibility runtime if old dependencies require it
- expose local lobby on a predictable port
- support local end-to-end multiplayer testing

Compatibility endpoints to preserve:

```txt
GET  /protocol
GET  /lobby
POST /login
WS   /chat
WS   /peer
```

### 4. Local developer workflow

Recommended local commands:

```sh
node scripts/build-static.mjs
node scripts/check-static.mjs
docker compose up lobby
npx playwright test
```

Optional local static server:

```sh
python3 -m http.server 8080
```

## Acceptance criteria

- `dist/static` can be regenerated from source
- static checks pass
- lobby starts from Docker Compose
- Playwright smoke tests pass locally
- two local browser clients can still connect through F.Lobby
- no game-facing protocol changes were introduced

## Portfolio value

This phase demonstrates:

- legacy system stabilization
- deterministic build artifacts
- containerization
- browser testing
- compatibility-preserving modernization

## Do not do yet

Avoid in this phase:

- Vite/React rewrite
- TypeScript rewrite
- replacing F.Lobby with a generic WebSocket service
- Redis-backed scaling
- ECS/EKS deployment
- frontend framework migration
