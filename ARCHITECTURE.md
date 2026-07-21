# Crypto.me architecture

## Overview

Crypto.me is a Next.js Web3 identity aggregator deployed as a Cloudflare
Worker. It favors fast cached responses over synchronous third-party fan-out:
PostgreSQL stores profile snapshots, Hyperdrive connects Workers to PostgreSQL,
and Cloudflare Queues refresh stale services outside the request lifecycle.

The application is intentionally tolerant of partial failure. One missing API
key or unavailable collector should affect one card, not the entire profile.

## Runtime stack

- Next.js 15.5, primarily Pages Router
- OpenNext Cloudflare adapter
- Cloudflare Workers, Static Assets, Images, Queues, and Hyperdrive
- PostgreSQL with Prisma 6, `engineType = "client"`, and PrismaPg
- React 19, Chakra UI, ENS.js, and Viem

## Repository layout

```text
crypto.me-thirdweb/
├── custom-worker.ts              # OpenNext fetch + Queue consumer
├── open-next.config.ts           # OpenNext adapter configuration
├── wrangler.jsonc                # Worker bindings and triggers
├── next.config.mjs               # Next/OpenNext build configuration
├── lib/prisma.ts                 # request-scoped Prisma over Hyperdrive
├── prisma/schema.prisma          # PostgreSQL schema
├── public/_headers               # static asset cache policy
├── scripts/
│   ├── sanitize-opennext-env.js  # deployment credential-leak gate
│   └── with-local-cloudflare-env.js
└── src/
    ├── app/                      # root layout, fonts, and app assets
    ├── hooks/useFastProfile.ts   # cache polling/backoff
    ├── lib/
    │   ├── cacheStore.ts         # shared service config and response types
    │   └── profileRefresh.ts     # one bounded refresh/upsert operation
    └── pages/
        ├── [ens].tsx             # SSR profile page
        └── api/
            ├── profile.ts
            ├── fast-profile.ts
            └── services/*.ts
```

## Request path

### ENS page

1. A user requests `/{ens}`.
2. `getServerSideProps` reads `cached_profiles` through a request-scoped Prisma
   client.
3. If needed, `/api/profile` resolves ENS with a bounded Viem transport and
   writes the ENS snapshot.
4. A stale cached ENS snapshot may be refreshed with the real Workers
   `ctx.waitUntil`; the cached response is still returned first.

### Aggregated profile

1. The client calls `/api/fast-profile?address=0x...`.
2. The endpoint rejects anything other than a 40-byte Ethereum address.
3. It reads all rows for that address from `service_cache`.
4. It returns fresh, stale, or partial service data immediately.
5. For up to three stale services, it atomically claims a `(address, service)`
   lease in `sync_queue` and sends the claimed jobs to
   `PROFILE_REFRESH_QUEUE`.
6. The Queue consumer calls the corresponding internal service endpoint through
   `WORKER_SELF_REFERENCE`.
7. `refreshProfileService` upserts the normalized JSON string and timestamp.
8. A later client poll sees the new rows.

`sync_queue` is not the job transport. Cloudflare Queues is the durable
transport; the table provides cross-isolate enqueue deduplication and stale
lease recovery.

## Queue behavior

Cloudflare Queue delivery is at-least-once, so the consumer is idempotent:
`service_cache` is upserted by its unique `(address, service)` key.

Current production policy:

- batch size: 5
- batch wait: 5 seconds
- consumer concurrency: 3
- retries: 3
- retry delay: 60 seconds
- DLQ: `crypto-me-profile-refresh-dlq`
- enqueue lease: 15 minutes

Successful jobs delete their `sync_queue` lease. Upstream failures are recorded,
retried, and eventually reach the DLQ; the database lease can be reclaimed after
it is stale. When no Queue exists in `next dev`, a bounded one-service
`waitUntil` fallback keeps local development usable.

## PostgreSQL data model

The canonical schema is `prisma/schema.prisma`.

```prisma
model cached_profiles {
  id                  Int       @id @default(autoincrement())
  ens_name            String    @unique
  profile_data        String
  created_at          DateTime  @default(now())
  updated_at          DateTime  @default(now())
  last_sync_status    String?
  last_content_update DateTime  @default(now())
  next_sync_due       DateTime?
}

model service_cache {
  id           Int       @id @default(autoincrement())
  address      String
  service      String
  data         String
  last_updated DateTime  @default(now())
  expires_at   DateTime?
  error_count  Int       @default(0)
  last_error   String?

  @@unique([address, service])
  @@index([address])
  @@index([service])
  @@index([last_updated])
}

model sync_queue {
  id           Int       @id @default(autoincrement())
  address      String
  service      String
  priority     Int       @default(1)
  created_at   DateTime  @default(now())
  processing   Boolean   @default(false)
  attempts     Int       @default(0)
  last_attempt DateTime?
  error        String?

  @@unique([address, service])
  @@index([priority, created_at])
  @@index([processing])
}
```

`profile_data` and `service_cache.data` are JSON serialized into PostgreSQL text
columns for compatibility with the existing production schema.

## Database connections on Workers

`lib/prisma.ts` obtains `env.HYPERDRIVE.connectionString` from the OpenNext
request context, creates a PrismaPg adapter, and disconnects it before the
request or Queue batch ends. Hyperdrive owns pooling across requests. A global
Prisma singleton is unsafe in Workers because I/O objects cannot cross request
contexts.

The production Hyperdrive configuration uses the direct Neon origin, caps
origin connections at 10, and disables Hyperdrive query caching. Application
rows already implement explicit freshness; database query caching could return
stale reads immediately after an upsert.

## Cache semantics

- Successful service refresh: 24-hour expiry.
- Upstream failure or timeout: preserve/default data, increment `error_count`,
  record `last_error`, and retry after one hour.
- Aggregated response states: `hit`, `partial`, or `miss`.
- Client polling uses exponential backoff and picks up completed Queue work.
- In-memory state is never treated as authoritative.

## Service collectors

Collectors live under `src/pages/api/services`. Every collector must:

- validate input;
- use a bounded HTTP/RPC timeout;
- expose a deterministic empty/error shape;
- allow injected dependencies for tests;
- avoid module-global mutable request state.

ENS, Farcaster, NFT, DeFi, Passport, Icebreaker, Decentraland, and Zerion
collectors can run in `workerd` when configured. XMTP is different: the Node SDK
loads native modules, so the Worker endpoint proxies to a separately hosted
Node-compatible collector through `XMTP_SERVICE_URL`. Without that collector,
XMTP returns a scoped 503 and existing cached data remains available.

## Cloudflare deployment

`wrangler.jsonc` defines:

- Worker `crypto-me` and custom domain `crypto.me`;
- `HYPERDRIVE`, `PROFILE_REFRESH_QUEUE`, and `WORKER_SELF_REFERENCE`;
- static assets and Images bindings;
- Queue retry/concurrency/DLQ policy;
- Workers logs and traces.

Deployment sequence:

```bash
npm test
npx tsc --noEmit
npm run cf:build
npx wrangler deploy --dry-run
npm run db:deploy       # only when a migration is pending
npm run deploy
```

Cloudflare Workers Builds watches `pierce403/crypto.me-thirdweb` on `main`.
Its build command is `npm run cf:build`; its deploy command is
`OPEN_NEXT_DEPLOY=true npx wrangler deploy --keep-vars`. The flag prevents
Wrangler from delegating back through OpenNext's local platform proxy after the
OpenNext artifact has already been built and sanitized. Production Hyperdrive,
Queue, service, Images, and asset bindings still come from `wrangler.jsonc`.

Workers Builds deploys application code only. Production Prisma migrations
remain an explicit operator step before merging code that depends on them.

`npm run cf:build` is a security boundary. OpenNext normally copies `.env*`
values into generated `next-env.mjs` and server-function env files. The
sanitizer removes those files and byte-scans the complete `.open-next` output
against every local env value before deployment.

Static assets receive immutable caching for hashed Next files. The Worker owns
SSR and API routes; Cloudflare's edge serves the asset binding.

## Secrets and observability

Provider credentials are Cloudflare Worker secrets. Raw PostgreSQL credentials
must not be uploaded because the Worker receives only a Hyperdrive binding.

Use `/api/health` to prove a database query succeeds, `npx wrangler tail
crypto-me` for live logs, Queue metrics for delivery/retry health, and the DLQ
for poison jobs. A deployment is not complete until both the workers.dev URL
and `https://crypto.me` have been verified in a real browser.
