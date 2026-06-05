FROM node:22-bookworm-slim AS runtime-deps

ENV NODE_ENV=production \
    PORT=8001

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force

FROM runtime-deps AS test

ENV PUBLIC_LOBBY=true

COPY . ./
RUN node --check index.js \
    && node --check lobby.js
RUN set -eux; \
    node index.js & pid="$!"; \
    trap 'kill "$pid" 2>/dev/null || true' EXIT; \
    node -e "(async () => { const base = 'http://127.0.0.1:' + process.env.PORT; const deadline = Date.now() + 5000; async function waitFor(path) { let lastError; while (Date.now() < deadline) { try { const response = await fetch(base + path); if (response.ok) return response; lastError = new Error(path + ' returned ' + response.status); } catch (error) { lastError = error; } await new Promise((resolve) => setTimeout(resolve, 100)); } throw lastError; } const health = await waitFor('/healthz'); const protocol = await waitFor('/protocol'); const protocolBody = await protocol.json(); if ((await health.json()).ok !== true) throw new Error('/healthz did not report ok'); if (protocolBody.name !== 'F.Lobby (WebSocket)') throw new Error('/protocol did not report websocket lobby'); })().catch((error) => { console.error(error); process.exit(1); });"; \
    kill "$pid"; \
    wait "$pid" || true; \
    trap - EXIT; \
    printf '%s\n' 'f-lobby test stage passed' > /tmp/f-lobby-test-stage-success

FROM runtime-deps AS production

COPY . ./
COPY --from=test /tmp/f-lobby-test-stage-success /app/.f-lobby-test-stage-success
RUN test -s /app/.f-lobby-test-stage-success \
    && chown -R node:node /app

EXPOSE 8001

USER node

CMD ["node", "index.js"]
