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

## Run the game

From the repository root:

```sh
python3 -m http.server 8080
```

Open:

```txt
http://localhost:8080/apps/game/game/game.html
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
- There is no root `package.json` or npm workspace yet.
- Static assets are served from `/assets` when running the root Python HTTP server.
