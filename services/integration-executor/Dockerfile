FROM node:22-bookworm-slim AS deps
WORKDIR /executor
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

FROM oven/bun:1.4.3
WORKDIR /executor
COPY --from=deps /executor/node_modules node_modules
COPY package.json ACTIVEPIECES-LICENSE ./
COPY src/server.ts src/worker.ts src/pieces.ts src/rest.ts src/meta-ads.ts src/allowlist.json ./src/
USER bun
ENV NODE_ENV=production PORT=8090
EXPOSE 8090
CMD ["bun", "src/server.ts"]
