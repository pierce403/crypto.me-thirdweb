# Crypto.me Thirdweb

Crypto.me is a cache-first Web3 identity aggregator. A profile combines ENS,
Farcaster, NFT, DeFi, XMTP, and other service data while still returning useful
cached results when an upstream provider is slow or unavailable.

Production runs on **Cloudflare Workers** through OpenNext. PostgreSQL remains
the source of truth; Workers reach it through **Hyperdrive**, and stale profile
services are refreshed by **Cloudflare Queues**.

## Stack

- Next.js 15 (Pages Router, with shared App Router assets under `src/app`)
- OpenNext for Cloudflare Workers
- PostgreSQL, Prisma, `@prisma/adapter-pg`, and Hyperdrive
- Cloudflare Queues for durable background refreshes
- Chakra UI, React, TypeScript, ENS.js, and Viem

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full request, cache, and Queue
flow.

## How profile loading works

1. `src/pages/[ens].tsx` serves cached ENS profile data during SSR.
2. The client calls `/api/fast-profile?address=0x...`.
3. The API reads `service_cache` through Hyperdrive and returns cached or partial
   data immediately.
4. Stale services receive a short lease in `sync_queue` and are sent to
   `crypto-me-profile-refresh`.
5. The Queue consumer in `custom-worker.ts` calls the bounded service collector,
   upserts `service_cache`, and releases the lease.
6. Client polling observes the refreshed rows on a later request.

## Local development

```bash
npm install
npm run dev
```

The app requires PostgreSQL. Set `DATABASE_URL` in an ignored `.env` or
`.env.local` file. Provider credentials are optional for local development;
collectors without credentials return explicit empty/error states.

Useful commands:

```bash
npm test                    # deterministic collector smoke tests
npm run build               # Prisma generation + Next.js production build
npm run cf:build            # OpenNext build + credential-leak gate
npm run preview             # local workerd preview with Hyperdrive emulation
npm run cf:typegen          # regenerate Cloudflare binding/runtime types
npm run db:dev              # prisma db push (development only)
npm run db:migrate          # create a development migration
npm run db:deploy           # explicitly apply production migrations
```

## Cloudflare deployment

Cloudflare configuration lives in `wrangler.jsonc`. Production uses:

- Worker: `crypto-me`
- Custom domain: `crypto.me`
- Hyperdrive binding: `HYPERDRIVE`
- Queue binding: `PROFILE_REFRESH_QUEUE`
- Dead-letter queue: `crypto-me-profile-refresh-dlq`
- Self service binding: `WORKER_SELF_REFERENCE`
- Static assets and Cloudflare Images bindings

Deploy with the package script so the OpenNext artifact is sanitized before it
can be uploaded:

```bash
npm run deploy
```

Production is also connected to Cloudflare Workers Builds:

- Repository: `pierce403/crypto.me-thirdweb`
- Production branch: `main`
- Build command: `npm run cf:build`
- Deploy command: `OPEN_NEXT_DEPLOY=true npx wrangler deploy --keep-vars`

Every push to `main` builds and deploys Worker `crypto-me`. The
`OPEN_NEXT_DEPLOY` flag tells Wrangler to upload the artifact that Workers
Builds already produced instead of starting OpenNext's local platform proxy,
which would require a local Hyperdrive connection string in CI. The deployed
Worker still receives the remote `HYPERDRIVE` binding from `wrangler.jsonc`.

Do not replace that with a bare `opennextjs-cloudflare deploy`: OpenNext copies
values from Next `.env*` files into its generated output by default.
`scripts/sanitize-opennext-env.js` removes generated env files and refuses to
continue if any local credential value is still present.

Database migrations are intentionally separate from application deployment:

```bash
npm run db:deploy
npm run deploy
```

Workers Builds does not run database migrations. Apply a pending production
migration explicitly before merging the application change that depends on it.

Set provider credentials as Worker secrets, never as committed `vars` and never
as raw production database URLs. Hyperdrive is the only production database
binding.

```bash
npx wrangler secret put NEYNAR_API_KEY
npx wrangler secret put ALCHEMY_API_KEY
npx wrangler secret put OPENSEA_API_KEY
npx wrangler tail crypto-me
```

Only add a credential after validating it with its provider. Missing DeBank,
Zerion, Passport, or other credentials deliberately produce degraded collector
data instead of taking down the profile page.

XMTP's Node SDK uses native modules that cannot execute in `workerd`. Production
XMTP refreshes therefore use the separate Cloudflare Container in
`services/xmtp-collector`. Configure `XMTP_SERVICE_URL` with its `/xmtp`
endpoint and set the matching `XMTP_SERVICE_TOKEN`; both are required for the
authenticated production collector.

## Primary endpoints

- `GET /api/health` — verifies the Worker can query PostgreSQL
- `GET /api/profile?ens_name=vitalik.eth` — ENS profile cache
- `GET /api/fast-profile?address=0x...` — aggregated service cache
- `GET /api/services/{service}?address=0x...` — one bounded collector
- `GET /api/recent-profiles` — recently accessed ENS profiles
- `GET /api/queue` — describes the durable Queue configuration
