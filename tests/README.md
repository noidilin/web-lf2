# Tests

## F.Lobby contract smoke

Run the legacy F.Lobby 0.1 endpoint smoke checks against the Dockerized lobby:

```sh
pnpm run test:lobby
```

The checks cover `GET /protocol`, `GET /lobby`, and invalid `POST /login` responses. See `docs/flobby-compatibility.md` for the compatibility contract.
