# Scripts

## Static artifact build

Regenerate the Phase 1 legacy game artifact from the repository root:

```sh
node scripts/build-static.mjs
```

The build fails fast when required source inputs are missing and writes `dist/static`:

```txt
dist/static/
  game/
  LF/
  core/
  third_party/
  LF2_19/
```

Serve the generated artifact locally with:

```sh
cd dist/static
python3 -m http.server 8080
```

Then open `http://localhost:8080/game/game.html`.
