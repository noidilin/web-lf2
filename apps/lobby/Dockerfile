FROM node:12-buster-slim

ENV NODE_ENV=production \
    PORT=8001

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production \
    && npm cache clean --force

COPY . ./
RUN chown -R node:node /app

EXPOSE 8001

USER node

CMD ["node", "index.js"]
