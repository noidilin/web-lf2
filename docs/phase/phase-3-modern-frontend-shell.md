# Plan Phase 3 — Modern frontend shell with Vite and React

## Goal

Introduce a modern frontend stack without rewriting the legacy game engine.

This phase adds Vite and React as a launcher, portfolio shell, lobby/status UI, and deployment-friendly frontend layer while preserving the existing RequireJS game runtime.

## When to start

Start this phase only after Phase 2 is stable:

- static game deploys to S3/CloudFront
- lobby deploys to ECS Fargate
- deployed game can connect to deployed lobby
- Playwright tests are reliable
- CI/CD works for both static and lobby artifacts

## Target architecture

```txt
React/Vite shell
  - landing page
  - game launcher
  - environment-aware lobby URL
  - status/help/about pages
  - optional lobby status dashboard

Legacy game runtime
  - RequireJS application
  - existing assets
  - existing F.Lobby integration
```

Recommended routing model:

```txt
/
  React portfolio/launcher shell

/play
  launches or embeds legacy game

/legacy/game/game.html
  original RequireJS game entrypoint
```

## Tasks

### 1. Add Vite and React app

Recommended location:

```txt
apps/web/
```

Suggested files:

```txt
apps/web/package.json
apps/web/vite.config.ts
apps/web/src/main.tsx
apps/web/src/App.tsx
apps/web/src/pages/Home.tsx
apps/web/src/pages/Play.tsx
apps/web/src/pages/LobbyStatus.tsx
```

### 2. Preserve legacy game as static content

Do not rewrite the game engine or networking code yet.

Options:

```txt
Option A: React shell links to legacy game URL
Option B: React shell embeds legacy game in an iframe
Option C: React shell copies legacy artifact under public/legacy
```

Recommended first approach:

```txt
React shell
  -> link/button to legacy game
```

This minimizes risk and keeps gameplay validation simple.

### 3. Environment-aware configuration

Add build-time/runtime config for:

```txt
VITE_GAME_URL
VITE_LOBBY_URL
VITE_ENVIRONMENT
VITE_ANALYTICS_ENABLED
```

The React shell should display which backend/environment it will use.

### 4. Useful React features

Good first React features:

- landing page describing the modernization project
- play button
- environment selector for dev/staging/prod, if appropriate
- lobby health/status indicator
- deployment version/build SHA display
- links to architecture and repo docs
- troubleshooting instructions for players

Avoid initially:

- replacing the actual game UI
- replacing the network menu
- rewriting canvas/rendering code
- changing F.Lobby protocol behavior

### 5. Update static build pipeline

The static artifact should include both:

```txt
dist/static/
  index.html              # React shell
  assets/                 # Vite assets
  legacy/                 # legacy game artifact
```

Or keep separate CloudFront paths:

```txt
/
  React shell

/game/
  legacy game
```

### 6. Tests

Add Playwright tests for:

- React shell loads
- play button opens legacy game
- lobby status fetch works
- no fatal console errors
- deployed CloudFront smoke test passes

## Acceptance criteria

- Vite/React app builds successfully
- React shell deploys through existing S3/CloudFront pipeline
- legacy game remains playable
- deployed game still connects to F.Lobby
- Playwright tests cover shell and legacy launch path
- no breaking changes to game-facing protocol

## Portfolio value

This phase demonstrates:

- modern frontend tooling
- incremental legacy modernization
- safe strangler-fig migration pattern
- environment-aware frontend deployment
- frontend CI/CD integration

## Do not do yet

Avoid in this phase:

- full game rewrite
- replacing RequireJS internally
- replacing F.Lobby browser contract
- migrating multiplayer UI before tests document behavior
- EKS migration
