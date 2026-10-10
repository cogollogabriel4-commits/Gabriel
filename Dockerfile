FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production DATA_DIR=/data PORT=3000 TRUST_PROXY=1
WORKDIR /app
RUN mkdir -p /data /respaldos && chown node:node /data /respaldos
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER node
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "src/server.js"]
