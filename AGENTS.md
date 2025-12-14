# AGENTS.md

This file is for coding agents (LLMs). Think of it as a short, practical README so an agent can land changes safely and quickly.

## Mission
Crypto.me Thirdweb is a Web3 identity aggregator. It builds a unified profile page from on-chain + off-chain services (ENS, Farcaster, DeFi/NFTs, XMTP, etc.) with a **cache-first + background refresh** architecture so pages load fast even when third parties are slow.

## Working Style (inspired by Recurse Center)
- Be curious: ask clarifying questions early if requirements are ambiguous.
- Prefer small, reversible changes: ship increments, verify, then iterate.
- Optimize for “something works” first: return cached/partial data quickly, then refresh in the background.
- Be kind and assume good intent: keep communication direct, constructive, and low-ego.

## Architecture

### Tech Stack
- **Framework**: Next.js (Pages Router primarily, moving towards App Router).
- **Database**: PostgreSQL (Production + local dev).
- **ORM**: Prisma.
- **Styling**: Chakra UI + Tailwind CSS.
- **Web3**: `viem`, `@ensdomains/ensjs`.

### Key Components
1. **`src/pages/[ens].tsx`**: Profile page. SSR uses cached ENS profile data when available; the client can resolve/fill in missing ENS data.
2. **`src/pages/api/profile.ts`**: ENS resolver + `cached_profiles` SWR cache (serves cached immediately, refreshes when stale).
3. **`src/pages/api/fast-profile.ts`**: Aggregator endpoint. Reads `service_cache` and triggers background refresh when stale/missing.
4. **`src/pages/api/services/*`**: Service scrapers (ENS, Farcaster, XMTP, etc.). These should be fast and have timeouts.
5. **`src/lib/cacheStore.ts`**: Shared types/config (`FastProfileData`, `SERVICES_CONFIG`) and `globalFetchLock`.
6. **`lib/prisma.ts`**: Prisma singleton. **Always** import `prisma` from here (never instantiate `new PrismaClient()` in routes).

## Data Flow
1.  **Request**: User visits `/[ens]`.
2.  **SSR**: `src/pages/[ens].tsx` returns cached ENS info immediately if available.
3.  **Client**: If ENS info is missing, the client calls `/api/profile?ens_name=...` to resolve/fill it in.
4.  **Client**: `useFastProfile` calls `/api/fast-profile?address=...`.
3.  **API**:
    *   Checks `service_cache` table.
    *   Returns cached data immediately (even if stale).
    *   If stale/missing, triggers background fetch for all services defined in `SERVICES_CONFIG`.
4.  **Background Fetch**:
    *   Calls `/api/services/[service]` for each service.
    *   Updates `service_cache` with new JSON data.
    *   Logs updates to `recentUpdatesLog`.
5.  **Polling**: Frontend polls periodically. If the background fetch completes, the next poll picks up the fresh data.

## Development Guidelines

## Quick Commands
- Install: `npm install`
- Dev server: `npm run dev`
- Production build check: `npm run build`
- Lint: `npm run lint`

### Database
- Use `npm run db:dev` (`prisma db push`) for local schema changes.
- Use `npm run db:deploy` (`prisma migrate deploy`) for production.
- **Do not** use `--accept-data-loss` in production scripts.

### Git Workflow
- **Commit & Push**: After every significant update or task completion:
  - `git status`
  - `git commit -am "..."`
  - `git pull --rebase origin main`
  - `git push origin main`

### Adding a New Service
1.  Add the service configuration to `SERVICES_CONFIG` in `src/lib/cacheStore.ts`.
2.  Create a new API route in `src/pages/api/services/[new-service].ts`.
3.  Create a UI card component in `src/components/FastServiceCards.tsx`.
4.  Add the card to the grid in `src/pages/[ens].tsx`.

### Common Pitfalls
- **Prisma Instances**: We saw connection limit errors because `PrismaClient` was being instantiated in multiple files. We fixed this by enforcing the singleton pattern in `lib/prisma.ts`.
- **ENS Validation**: We replaced custom regex with `@adraffy/ens-normalize` to handle complex ENS names correctly.
- **Circular Dependencies**: `fast-profile.ts` and `useFastProfile.ts` used to duplicate config. They now both rely on `src/lib/cacheStore.ts`.
- **Timeouts**: Never add unbounded `fetch()`/RPC calls in services. Keep service scrapers fast and fail-soft (return defaults + error info).

## Current Status (as of Dec 2025)
- **Refactoring**: We recently cleaned up the architecture to use shared configs and a singleton DB client.
- **Performance**: Polling now has exponential backoff.
- **UI**: Profile page is organized into sections (Identity, Social, Assets, Worlds) with a summary header.

## Environment Variables (common)
- `DATABASE_URL` (required)
- `ALCHEMY_API_KEY` or `ALCHEMY_RPC_URL` (recommended for stable ENS/RPC reads)
- `NEYNAR_API_KEY` (Farcaster)
- `OPENSEA_API_KEY` (if/when OpenSea calls are enabled)
- `XMTP_ENV` (`production` | `dev` | `local`) and optionally `XMTP_GATEWAY_HOST`

## Vercel Logs
To inspect production logs, you must be authenticated via the Vercel CLI (`vercel login`) or pass `--token`.
