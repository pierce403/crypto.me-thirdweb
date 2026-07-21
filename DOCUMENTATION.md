# Crypto.me developer documentation

Crypto.me is a Next.js application hosted on Cloudflare Workers. PostgreSQL is
accessed through Hyperdrive, Prisma clients are request-scoped, and Cloudflare
Queues refresh stale profile services.

## Setup

```bash
git clone https://github.com/pierce403/crypto.me-thirdweb.git
cd crypto.me-thirdweb
npm install
npm run dev
```

Set a PostgreSQL `DATABASE_URL` in `.env` or `.env.local`. Optional provider
credentials enable their matching collectors.

## Verification

```bash
npm test
npx tsc --noEmit
npm run build
npm run cf:build
npm run preview
```

`npm run preview` uses a local Hyperdrive connection string derived from the
ignored local database environment. The production build gate sanitizes and
scans `.open-next` before any deployment.

## APIs

- `/api/health` performs a real database query and returns 503 on failure.
- `/api/profile?ens_name=...` resolves and caches ENS profile data.
- `/api/fast-profile?address=0x...` returns the aggregated service cache and
  enqueues stale services.
- `/api/services/*` exposes independently testable service collectors.
- `/api/recent-profiles` lists recent ENS cache entries.
- `/api/queue` describes the durable Cloudflare Queue setup; it is not an
  in-memory event feed.

## Database workflow

The schema is in `prisma/schema.prisma` and contains `cached_profiles`,
`service_cache`, and the Queue deduplication table `sync_queue`.

```bash
npm run db:dev
npm run db:migrate
npm run db:deploy
```

Production migrations are explicit and are not run automatically by Worker
deployment.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for runtime details and [README.md](./README.md)
for Cloudflare operations.
