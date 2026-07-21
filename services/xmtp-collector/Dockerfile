FROM node:22-trixie-slim AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts=false \
    && node -e "import('@xmtp/node-sdk').then(() => process.stdout.write('XMTP SDK import verified\\n'))" \
    && find node_modules/@xmtp/node-bindings/dist -type f -name '*.node' \
      ! -name 'bindings_node.linux-x64-gnu.node' -delete

FROM node:22-trixie-slim

ENV NODE_ENV=production \
    PORT=8080 \
    XMTP_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src/async.mjs src/profile.mjs src/server.mjs ./src/

USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["node", "src/server.mjs"]
