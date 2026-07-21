# XMTP collector

This is the Node-compatible XMTP profile collector used by the Cloudflare
Worker at `crypto.me`. It runs as a separate Cloudflare Container so XMTP's
native Node bindings do not enter the OpenNext `workerd` bundle.

The edge Worker accepts only authenticated `GET /xmtp?address=0x...` requests,
validates the address before starting the singleton container, and strips the
bearer token before proxying. The container returns the version 2 payload
validated by `src/pages/api/services/xmtp.ts` in the main application.

## Local checks

```bash
npm ci
npm test
npm run typecheck
npm run build:image
```

## Deployment

Deploy this directory independently of the main OpenNext Worker:

```bash
npm run deploy
npx wrangler secret put COLLECTOR_TOKEN
```

Configure `crypto-me` with the collector's `/xmtp` URL as
`XMTP_SERVICE_URL` and the same bearer value as `XMTP_SERVICE_TOKEN`. Keep both
as Worker runtime secrets; never commit them or put them in Workers Builds
variables.

The repository's existing Cloudflare Workers Build deploys only the main
OpenNext Worker. This collector also needs a Docker-capable, path-filtered CI
job with a narrowly scoped Cloudflare Workers/Containers token before future
collector merges can deploy automatically.
