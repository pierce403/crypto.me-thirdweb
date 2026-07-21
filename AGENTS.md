# AGENTS.md

This is the practical operating guide for coding agents working in this repo.

## Mission

Crypto.me is a Web3 identity aggregator. It builds one profile from on-chain
and off-chain services with a cache-first, durable-background-refresh design.
Cached or partial data should remain useful when providers fail.

## Working style

- Prefer small, reversible changes and verify the public behavior.
- Keep service collectors bounded with explicit timeouts and fail-soft output.
- Never make the initial profile response wait for all third-party providers.
- Preserve unrelated worktree changes.

## Current architecture

- **Hosting**: Cloudflare Workers via `@opennextjs/cloudflare`
- **Framework**: Next.js 15, primarily Pages Router
- **Database**: PostgreSQL through Cloudflare Hyperdrive
- **ORM**: Prisma with the JavaScript engine and `@prisma/adapter-pg`
- **Background work**: Cloudflare Queues
- **UI**: Chakra UI + Tailwind CSS
- **Web3**: Viem + ENS.js

### Key files

1. `src/pages/[ens].tsx` — SSR profile page and client aggregation UI.
2. `src/pages/api/profile.ts` — ENS resolver and `cached_profiles` cache.
3. `src/pages/api/fast-profile.ts` — reads `service_cache`, claims dedupe
   leases in `sync_queue`, and enqueues stale services.
4. `src/pages/api/services/*` — bounded, independently testable collectors.
5. `src/lib/profileRefresh.ts` — one service refresh and cache upsert.
6. `custom-worker.ts` — OpenNext fetch handler plus Queue consumer.
7. `lib/prisma.ts` — request-scoped Prisma construction over Hyperdrive.
8. `wrangler.jsonc` — bindings, Queue policy, observability, and custom domain.
9. `scripts/sanitize-opennext-env.js` — mandatory deploy artifact leak gate.

### Data flow

1. `/[ens]` serves cached ENS identity data.
2. `useFastProfile` requests `/api/fast-profile` with a validated Ethereum
   address.
3. The API returns `service_cache` rows immediately.
4. Stale `(address, service)` pairs receive a `sync_queue` lease and are sent to
   `PROFILE_REFRESH_QUEUE` in batches of at most three.
5. The Queue consumer invokes one internal collector through
   `WORKER_SELF_REFERENCE`, upserts the cache, and releases the lease.
6. Failures use a one-hour cache backoff, Queue retries, and the DLQ. Polling
   later observes successful updates.

## Commands

- Install: `npm install`
- Next dev: `npm run dev`
- Tests: `npm test`
- Type check: `npx tsc --noEmit`
- Next build: `npm run build`
- Cloudflare build gate: `npm run cf:build`
- Local Worker preview: `npm run preview`
- Deploy Worker: `npm run deploy`
- Upload a Worker version: `npm run upload`
- Regenerate binding types: `npm run cf:typegen`

### Database

- `npm run db:dev` is for local schema synchronization.
- `npm run db:migrate` creates development migrations.
- `npm run db:deploy` explicitly applies production migrations.
- Never use `--accept-data-loss` in production.
- Never put a production database URL in Worker `vars` or secrets; use the
  `HYPERDRIVE` binding.

### Prisma on Workers

Do not restore a module-global Prisma singleton. A Workers request must create a
client with `getPrisma()`/`withPrisma()` and disconnect it before the request
finishes. Hyperdrive owns cross-request pooling; the adapter uses `maxUses: 1`
so a connection cannot leak across request contexts.

### Adding a service

1. Add it to `SERVICES_CONFIG` in `src/lib/cacheStore.ts`.
2. Add a timed collector under `src/pages/api/services/`.
3. Add its card to `src/components/FastServiceCards.tsx` and profile layout.
4. Add deterministic tests with injected dependencies.
5. Define required Worker secrets and document degraded behavior when absent.

### Common pitfalls

- OpenNext embeds `.env*` values unless the sanitized package build is used.
- Cloudflare Queues are at-least-once; keep writes idempotent and retain the
  `sync_queue` lease/deduplication logic.
- In-memory locks or logs are not durable across isolates.
- `ctx.waitUntil` extends work but is not a durable job queue.
- XMTP's Node SDK contains native modules and must run in an external
  Node-compatible collector, not in `workerd`.
- Validate all public cache keys before database or Queue work.

## Environment and operations

Common service settings include `NEYNAR_API_KEY`, `ALCHEMY_API_KEY` or
`ALCHEMY_RPC_URL`, `OPENSEA_API_KEY`, `DEBANK_API_KEY`, `ZERION_API_KEY`, and
Passport credentials. XMTP uses `XMTP_SERVICE_URL` and optional
`XMTP_SERVICE_TOKEN`.

Use Workers observability and `npx wrangler tail crypto-me` for production
logs. Verify both the workers.dev URL and `https://crypto.me` after deployment.

## Git workflow

After a completed task:

```bash
git status
git commit -am "..."
git pull --rebase origin main
git push origin main
```
