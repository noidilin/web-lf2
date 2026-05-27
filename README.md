# web-lf2

Legacy HTML5 LF2-style browser game with its original F.Lobby multiplayer server, organized as a small monorepo.

## Layout

```txt
apps/game/    Static RequireJS game client
apps/lobby/   Legacy F.Lobby server
assets/       Game data, sprites, sounds, backgrounds, AI, UI
scripts/      Future repo-level utility scripts
docs/         Project documentation and plans
tests/        Future tests/smoke checks
infra/        Future infrastructure files
dist/         Generated outputs / placeholders
```

## Build and run the static game artifact

From the repository root, regenerate the deterministic Phase 1 artifact:

```sh
node scripts/build-static.mjs
```

This creates `dist/static` with the legacy game client, `LF`, `core`, `third_party`, and the deployed `LF2_19` asset package.

Validate the generated artifact before using it as a baseline:

```sh
node scripts/check-static.mjs
# or
npm run check:static
```

The check verifies required deployed paths, the `LF2_19/` game config package, and unexpected insecure or protocol-relative external URL references.

Serve the artifact locally:

```sh
cd dist/static
python3 -m http.server 8080
```

Open:

```txt
http://localhost:8080/game/game.html
```

## Run the lobby server

Use Docker Compose from the repository root:

```sh
docker compose up lobby
```

Open:

```txt
http://localhost:8001/
```

In the game network menu, use third-party server:

```txt
http://localhost:8001
```

## Notes

- Do not install lobby dependencies with the host Node version.
- The lobby is intentionally run in `node:12-buster` to preserve legacy behavior.
- Root npm scripts wrap the static build/check and lobby smoke workflow.
- Static assets are served from `/assets` when running the root Python HTTP server.
