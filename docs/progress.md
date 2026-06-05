# Progress Tracking

- [x] Stage 0 — Local baseline and repository normalization
  - Manual validation confirmed that two players can connect through the lobby and play.
  - No root `package.json`, npm scripts, or npm workspaces.
  - Lobby dependencies remain isolated in `node:12-buster`.
  - `F.Lobby 0.1` protocol strings remain unchanged.
  - Asset-internal paths remain package-relative.
  - Game package config now points to root assets:

    ```json
    {"root":"../","package":"../../assets"}
    ```

## Recommended Timeline

- Phase 1 — Stabilize legacy app
  - static build
  - checks
  - Playwright
  - Dockerized lobby
- Phase 2 — AWS baseline
  - S3 + CloudFront
  - ECS Fargate + ALB
  - GitHub Actions
  - CloudWatch
- Phase 3 — Modern frontend shell
  - Vite
  - React
  - landing/launcher/lobby status UI
  - legacy game still preserved
- Phase 4 — Backend scalability
  - F.Lobby v2 or modernized F.Lobby
  - Redis/ElastiCache
  - multiple ECS tasks
- Phase 5 — Kubernetes capstone
  - EKS
  - Helm
  - ALB Ingress
  - HPA
  - PDB

## Status

Phase 2 now has a documented AWS baseline runbook at `docs/phase/phase-2-runbook.md`. The baseline covers private S3 + CloudFront static delivery, ECS Fargate + ALB HTTPS/WSS lobby hosting, GitHub Actions OIDC deployments for dev/prod, deployed smoke tests, and CloudWatch dashboard/alarms. Later phases keep Redis-backed lobby state, horizontal scaling, EKS, and frontend rewrite work out of this milestone.

The repository now uses the normalized layout:

```txt
apps/game/    RequireJS/AMD HTML5 game client
apps/lobby/   F.Lobby 0.1 lobby/chat/transport server
assets/       LF2 1.9 content package
scripts/
docs/
tests/
infra/
dist/
```

Validated local commands:

```sh
python3 -m http.server 8080
```

```txt
Game: http://localhost:8080/apps/game/game/game.html
```

```sh
docker compose up lobby
```

```txt
Lobby: http://localhost:8001/
Third-party server in game network menu: http://localhost:8001
```
