# Tests

## Playwright game smoke baseline

Run the browser smoke baselines against the built static artifact and Dockerized lobby:

```sh
npm run test:e2e
```

`pretest:e2e` builds `dist/static`, then Playwright serves that generated artifact and starts the local lobby with Docker Compose.

The basic game test loads the game page, verifies the root `.LFroot` element and `canvas.canvas` renderer element appear,
asserts the game config points at `LF2_19/`, checks for fatal console errors while suppressing known legacy noise,
and saves a screenshot to `screenshots/game-smoke-baseline.png`.

The game-to-lobby smoke is the baseline guard before modernization work: it browser-automates the legacy network menu,
connects to `http://127.0.0.1:8001`, asserts `/protocol` preserves the F.Lobby 0.1 WebSocket shape, and verifies the lobby iframe opens.

## F.Lobby contract smoke

Run the legacy F.Lobby 0.1 endpoint smoke checks against the Dockerized lobby:

```sh
pnpm run test:lobby
```

The checks cover `GET /protocol`, `GET /lobby`, and invalid `POST /login` responses.
