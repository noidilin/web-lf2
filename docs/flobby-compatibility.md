# F.Lobby 0.1 compatibility contract

Phase 1 preserves the legacy F.Lobby behavior that the browser game already depends on. Modernization work must not change these game-facing endpoint shapes without first updating the compatibility smoke tests and documenting a migration path.

## Local Docker workflow

Start the legacy lobby from the repository root:

```sh
docker compose up -d lobby
```

The local lobby listens on `http://localhost:8001`.

Run the endpoint contract smoke checks against the Dockerized lobby:

```sh
pnpm run test:lobby
```

To target a non-default lobby URL:

```sh
LOBBY_BASE_URL=http://127.0.0.1:8001 node --test tests/lobby-contract.test.mjs
```

## Required HTTP endpoints

### `GET /protocol`

Returns the unchanged WebSocket protocol identity used by the game:

```json
{
  "name": "F.Lobby (WebSocket)",
  "library": "/ws/network.js",
  "port": 8001,
  "path": "/peer",
  "address": "http://localhost:8001"
}
```

`address` reflects the request host. The protocol `name`, `library`, `port`, and `path` are the Phase 1 compatibility contract.

### `GET /lobby`

Returns the legacy lobby HTML page.

### `POST /login`

Accepts JSON with `name`, `room`, and `origin`. Missing values preserve the legacy response shape:

```json
{ "success": false, "mess": "Invalid name." }
```

```json
{ "success": false, "mess": "Invalid room." }
```

A valid local login returns:

```json
{ "success": true }
```

## Required WebSocket endpoints

The legacy lobby also exposes:

- `WS /chat`
- `WS /peer`

These are part of the preserved F.Lobby 0.1 game-facing protocol surface.
