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
    && node --check lobby.js \
    && node --check scripts/docker-smoke.mjs
RUN set -eux; \
    npm run test:docker-smoke; \
    printf '%s\n' 'f-lobby test stage passed' > /tmp/f-lobby-test-stage-success

FROM runtime-deps AS production

COPY . ./
COPY --from=test /tmp/f-lobby-test-stage-success /app/.f-lobby-test-stage-success
RUN test -s /app/.f-lobby-test-stage-success \
    && chown -R node:node /app

EXPOSE 8001

USER node

CMD ["node", "index.js"]
