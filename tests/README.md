# Tests

## Playwright game smoke baseline

Run the browser smoke baseline against the built static artifact:

```sh
node scripts/build-static.mjs
npm run test:e2e
```

The test loads the game page, verifies the root `.LFroot` element and `canvas.canvas` renderer element appear,
asserts the game config points at `LF2_19/`, checks for fatal console errors while suppressing known legacy noise,
and saves a screenshot to `screenshots/game-smoke-baseline.png`.

## F.Lobby contract smoke

Run the legacy F.Lobby 0.1 endpoint smoke checks against the Dockerized lobby:

```sh
pnpm run test:lobby
```

The checks cover `GET /protocol`, `GET /lobby`, and invalid `POST /login` responses. See `docs/flobby-compatibility.md` for the compatibility contract.
