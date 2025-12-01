# AGENTS.md

## Project Overview
Crypto.me Thirdweb is a web3 identity aggregator that creates a unified profile page from various on-chain and off-chain services (ENS, Farcaster, DeFi, etc.). It uses a "fast profile" architecture where data is fetched in the background and cached in a PostgreSQL database to ensure instant page loads.

## Architecture

### Tech Stack
- **Framework**: Next.js (Pages Router primarily, moving towards App Router).
- **Database**: PostgreSQL (Production), SQLite (Local Dev).
- **ORM**: Prisma.
- **Styling**: Chakra UI + Tailwind CSS.
- **Web3**: `viem`, `@ensdomains/ensjs`.

### Key Components
1.  **`src/pages/api/fast-profile.ts`**: The core API endpoint. It checks the DB cache first. If data is missing or stale, it triggers a background fetch (`backgroundFetchRealData`) which calls individual service endpoints.
2.  **`src/lib/cacheStore.ts`**: Contains shared type definitions (`FastProfileData`, `SERVICES_CONFIG`) and the in-memory `globalFetchLock` to prevent duplicate background fetches.
3.  **`src/hooks/useFastProfile.ts`**: Custom React hook for the frontend. Handles polling, optimistic updates, and exponential backoff for error handling.
4.  **`src/lib/prisma.ts`**: Singleton instance of `PrismaClient`. **ALWAYS** import `prisma` from here, never instantiate `new PrismaClient()` directly in API routes.

## Data Flow
1.  **Request**: User visits `/[ens]`.
2.  **Frontend**: `useFastProfile` calls `/api/fast-profile?address=...`.
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

### Database
- Use `npm run db:dev` (`prisma db push`) for local schema changes.
- Use `npm run db:deploy` (`prisma migrate deploy`) for production.
- **Do not** use `--accept-data-loss` in production scripts.

### Git Workflow
- **Commit & Push**: Always commit and push your changes after every significant update or task completion. This ensures work is saved and accessible.

### Adding a New Service
1.  Add the service configuration to `SERVICES_CONFIG` in `src/lib/cacheStore.ts`.
2.  Create a new API route in `src/pages/api/services/[new-service].ts`.
3.  Create a UI card component in `src/components/FastServiceCards.tsx`.
4.  Add the card to the grid in `src/pages/[ens].tsx`.

### Common Pitfalls
- **Prisma Instances**: We saw connection limit errors because `PrismaClient` was being instantiated in multiple files. We fixed this by enforcing the singleton pattern in `lib/prisma.ts`.
- **ENS Validation**: We replaced custom regex with `@adraffy/ens-normalize` to handle complex ENS names correctly.
- **Circular Dependencies**: `fast-profile.ts` and `useFastProfile.ts` used to duplicate config. They now both rely on `src/lib/cacheStore.ts`.

## Current Status (as of Dec 2025)
- **Refactoring**: We recently cleaned up the architecture to use shared configs and a singleton DB client.
- **Performance**: Polling now has exponential backoff.
- **UI**: Profile page is organized into sections (Identity, Social, Assets, Worlds) with a summary header.
