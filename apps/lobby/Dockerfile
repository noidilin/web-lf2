FROM node:12-buster-slim

ENV NODE_ENV=production \
    PORT=8001

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production \
    && npm cache clean --force

COPY . ./

EXPOSE 8001

CMD ["node", "index.js"]
