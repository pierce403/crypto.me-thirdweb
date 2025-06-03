# Crypto.me Thirdweb - Architecture Documentation

## Overview

Crypto.me Thirdweb is a Next.js-based web application that serves as a central profile page for web3 identities. It allows users to view and manage their profiles, aggregating data from multiple web3 services like Ethereum Name Service (ENS), Farcaster, OpenSea, and others. This aggregated data is cached in the database to ensure fast load times for profile pages, with a target refresh cycle of daily or upon visit if older than a day.

## Tech Stack

- **Framework**: Next.js 14.2.13 (React-based full-stack framework)
- **Language**: TypeScript 
- **Database**: PostgreSQL with Prisma ORM
- **UI Library**: Chakra UI with Framer Motion animations
- **Web3 Integration**: ENS.js with Viem for Ethereum interactions
- **Styling**: Tailwind CSS + Chakra UI components
- **Image Handling**: IPFS integration with Pinata gateway

## Project Structure

```
crypto.me-thirdweb/
├── app/                          # App Router directory (Next.js 13+ structure)
│   ├── layout.tsx               # Root layout with font configurations
│   ├── globals.css              # Global CSS styles
│   └── fonts/                   # Custom font files (Geist)
├── src/
│   └── pages/                   # Pages Router (primary routing structure)
│       ├── index.tsx            # Homepage with ENS search and recent profiles
│       ├── [ens].tsx            # Dynamic profile pages for ENS names
│       ├── _app.tsx             # App component with Chakra UI provider
│       └── api/                 # API routes
│           ├── health.ts        # Health check endpoint
│           ├── profile.ts       # ENS-specific profile fetching and caching
│           ├── fast-profile.ts  # Aggregated multi-service profile caching
│           └── recent-profiles.ts # Recent profiles listing
├── lib/
│   └── prisma.ts               # Prisma client configuration
├── prisma/
│   ├── schema.prisma           # Database schema definition
│   └── migrations/             # Database migration files
├── package.json                # Dependencies and scripts
├── next.config.js             # Next.js configuration
├── tailwind.config.ts         # Tailwind CSS configuration
├── fix_database.sh            # Database integrity check and repair
└── reset_database.sh          # Database reset utility
```

## Core Architecture Components

### 1. Frontend Layer

#### Homepage (`src/pages/index.tsx`)
- **Purpose**: Landing page with ENS name search functionality
- **Features**:
  - ENS name input form with validation
  - Display of recently updated profiles
  - Navigation to individual profile pages
- **Components Used**: Chakra UI components (Container, Input, Button, etc.)
- **State Management**: React hooks for form state and recent profiles

#### Profile Pages (`src/pages/[ens].tsx`)
- **Purpose**: Individual ENS profile display pages
- **Features**:
  - Server-side rendering for fast initial load
  - Avatar display with IPFS gateway conversion
  - Profile information display (ENS name, ETH address, avatar)
  - Real-time refresh functionality
  - Intelligent background refresh for stale data
- **Rendering Strategy**: Server-side rendering with background updates

#### App Configuration (`src/pages/_app.tsx`)
- **Purpose**: Global app configuration and providers
- **Features**: Chakra UI provider wrapper for consistent theming

### 2. API Layer

#### Health Check (`src/pages/api/health.ts`)
- **Purpose**: Application health monitoring
- **Endpoint**: `GET /api/health`
- **Response**: `{ "status": "healthy" }`

#### Profile API (`src/pages/api/profile.ts`)
- **Purpose**: Primarily for ENS-specific data caching in the `cached_profiles` table. This might be an older system or used for specific ENS lookups, distinct from the broader `fast-profile` service aggregation.
- **Endpoint**: `GET /api/profile?ens_name={name}&refresh={boolean}`
- **Features**:
  - ENS resolution using ENS.js
  - Profile data caching in PostgreSQL (`cached_profiles` table)
  - Automatic refresh on stale data
  - Error handling for invalid ENS names
  - IPFS avatar URL resolution

#### Fast Profile API (`src/pages/api/fast-profile.ts`)
- **Purpose**: Provides aggregated profile data from multiple services (ENS, Farcaster, OpenSea, etc.) for a given Ethereum address.
- **Endpoint**: `GET /api/fast-profile?address={address}`
- **Features**:
    - Serves data primarily from the `service_cache` table in PostgreSQL.
    - If cached data is fresh (e.g., `expires_at` > now), it's returned immediately.
    - If data is stale or missing for any service, it returns the available cached data (if any) and triggers an asynchronous background process.
    - The background process fetches updated data from individual `/api/services/*` endpoints and updates the `service_cache` table.

#### Recent Profiles (`src/pages/api/recent-profiles.ts`)
- **Purpose**: Retrieve recently updated profiles
- **Endpoint**: `GET /api/recent-profiles`
- **Features**:
  - Returns 10 most recently updated profiles
  - Filters for successfully synced profiles only

### 3. Database Layer

#### Prisma ORM Configuration (`lib/prisma.ts`)
- **Purpose**: Database client management
- **Features**:
  - Environment-aware client instantiation
  - Connection pooling for production
  - Global instance prevention in development

#### Database Schema (`prisma/schema.prisma`)
The schema includes tables for caching ENS-specific profiles (`cached_profiles`), aggregated service data (`service_cache`), and managing synchronization tasks (`sync_queue`).

```prisma
model cached_profiles {
  id               Int       @id @default(autoincrement())
  ens_name         String    @unique
  profile_data     String    // JSON string containing profile information
  created_at       DateTime  @default(now())
  updated_at       DateTime  @default(now()) // Automatically updated on write
  last_sync_status String?   // Status of last ENS sync attempt
}

model service_cache {
  id           Int       @id @default(autoincrement())
  address      String    // Ethereum address, normalized to lowercase
  service      String    // Name of the service (e.g., 'ens', 'farcaster')
  data         Json      // JSON data from the service
  last_updated DateTime  @default(now()) @updatedAt
  expires_at   DateTime? // Timestamp indicating when the cache entry is considered stale
  error_count  Int       @default(0)
  last_error   String?   // Stores the last error message if fetching failed

  @@unique([address, service]) // Ensures one entry per address-service pair
  @@index([address])
  @@index([service])
  @@index([expires_at])
}

model sync_queue {
  id              Int      @id @default(autoincrement())
  address         String   @unique // Address to be synced
  status          String   @default("pending") // e.g., pending, processing, completed, failed
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
  processing_started_at DateTime?
  error_message   String?
  retry_count     Int      @default(0)
}
```
The `cached_profiles` model is used for specific ENS lookups, while `service_cache` is the primary cache for aggregated profile data served by `fast-profile.ts`.

### 4. Web3 Integration

#### ENS Resolution
- **Library**: `@ensdomains/ensjs` with Viem transport
- **Chain**: Ethereum Mainnet
- **Features**:
  - Address record resolution
  - Text record fetching (avatar)
  - Error handling for non-existent ENS names

#### IPFS Integration
- **Gateway**: Pinata Cloud Gateway
- **Conversion**: Automatic `ipfs://` to HTTP gateway URL conversion
- **Usage**: Avatar image serving from IPFS

## Data Flow Architecture

### 1. Aggregated Profile Page Loading Flow (using `fast-profile.ts`)

```
User requests /{ens_name}
    ↓
getServerSideProps in `src/pages/[ens].tsx` executes (minimal ENS lookup for address & initial avatar)
    ↓
`useFastProfile` hook in `src/pages/[ens].tsx` calls `GET /api/fast-profile?address={address}`
    ↓
`/api/fast-profile` checks `service_cache` table for all configured services for the given address:
    ├── If all services data are cached & fresh (e.g., `expires_at` > now): Return immediately from DB cache.
    └── If any service data is stale or missing:
        ├── Return currently available cached data (partial or full, marked as stale/miss).
        └── Asynchronously trigger background fetch:
            ↓
            For each service: Call respective `/api/services/{service_name}?address={address}`
                ↓
            Service API (e.g., `/api/services/farcaster`) fetches data from 3rd party (e.g., Neynar API)
                ↓
            `/api/fast-profile` background process receives data, `upserts` into `service_cache` table (updates `data`, `last_updated`, `expires_at` set to T+24h).
Frontend (`src/pages/[ens].tsx`) displays data and updates automatically as new data arrives from polling or initial background fetch.
```

### 2. Background Refresh Strategy for `fast-profile.ts`

- Data for `fast-profile.ts` is refreshed if the `expires_at` timestamp in the `service_cache` table is past, or if a manual refresh is triggered from the UI.
- This refresh involves `fast-profile.ts` initiating an asynchronous process that re-fetches data from the individual `/api/services/*` endpoints.
- Upon successful fetch, the corresponding entries in the `service_cache` table are updated with the new data and a new `expires_at` time (typically 24 hours from the refresh time).
- If a fetch fails, the `error_count` is incremented, `last_error` is recorded, and `expires_at` might be set to a shorter duration to allow quicker retries for failing services.

### 3. Legacy Profile Page Loading Flow (using `src/pages/api/profile.ts`)

This flow applies if the `/api/profile` endpoint is still used for specific ENS lookups.
```
User requests /{ens_name} (or a component calls /api/profile)
    ↓
getServerSideProps or client-side fetch calls /api/profile?ens_name={name}
    ↓
Check `cached_profiles` table
    ├── If cached & fresh (e.g., updated_at within 1 hour): Return immediately
    ├── If cached & stale: Return cached + trigger background refresh (if `refresh=true` or old logic)
    └── If not cached: Perform full ENS lookup
         ↓
    ENS.js resolves address & avatar
         ↓
    Store in `cached_profiles` database table
         ↓
    Return profile data
```

### 4. Caching Strategy

- **L1 Cache for Aggregated Profiles**: The primary L1 cache for data served by `fast-profile.ts` is the `service_cache` table in PostgreSQL.
- **L1 Cache for ENS-Specific Data**: The `cached_profiles` table serves as a cache for ENS-specific lookups via `api/profile.ts`.
- **Cache Key**:
    - For `service_cache`: A composite key of `address` and `service_name`.
    - For `cached_profiles`: `ens_name`.
- **TTL Strategy**:
    - For `service_cache`: Time-based refresh, typically aiming for daily updates. The `expires_at` field in `service_cache` manages this. Data is considered stale if `NOW() > expires_at`.
    - For `cached_profiles`: Time-based refresh (e.g., 1-hour staleness threshold).
- **Cache Invalidation**:
    - For `service_cache`:
        - Manual refresh trigger from the UI calls `/api/fast-profile`, which initiates a background update.
        - Automatic refresh on visit if data is stale (i.e., `expires_at` is past).
    - For `cached_profiles`: Manual refresh trigger via `/api/profile?refresh=true`.

## Configuration & Environment

### Next.js Configuration (`next.config.js`)
```javascript
{
  reactStrictMode: true,
  images: {
    domains: ['gateway.pinata.cloud'], // IPFS gateway for avatars
  }
}
```

### Build Process
1. `prisma generate` - Generate Prisma client
2. `next build` - Build Next.js application
3. Database migrations automatically applied

### Development Scripts
- `npm run dev` - Start development server
- `npm run build` - Production build
- `npm run lint` - ESLint checking

## Database Management

### Migration System
- **Tool**: Prisma Migrate
- **Location**: `prisma/migrations/`
- **Commands**:
  - `npx prisma migrate dev` - Apply migrations in development
  - `npx prisma migrate deploy` - Apply migrations in production

### Maintenance Scripts

#### Database Fix (`fix_database.sh`)
- **Purpose**: SQLite integrity checking and repair
- **Features**:
  - Integrity validation
  - Automatic corruption repair
  - Migration application
- **Note**: Script references SQLite but schema uses PostgreSQL

#### Database Reset (`reset_database.sh`)
- **Purpose**: Complete database reset
- **Features**:
  - Force migration reset
  - Prisma client regeneration

## Error Handling & Resilience

### API Error Handling
- **Invalid ENS Names**: 404 responses with cleanup
- **ENS Resolution Failures**: Graceful fallback with database cleanup
- **Database Errors**: 500 responses with error logging

### Client-Side Error Handling
- **Failed Profile Loads**: "Profile not found" message
- **Network Errors**: Console logging with user feedback
- **Stale Data**: Automatic background refresh attempts

## Performance Optimizations

### Server-Side Rendering
- **Immediate Response**: Cached profiles served instantly
- **SEO Friendly**: Full HTML generation for crawlers
- **Background Updates**: Non-blocking refresh for stale data

### Image Optimization
- **Next.js Image Component**: Automatic optimization and lazy loading
- **IPFS Gateway**: Reliable avatar serving via Pinata
- **Responsive Images**: Automatic sizing based on viewport

### Database Optimization
- **Database Caching**: The `service_cache` table significantly reduces calls to multiple third-party services for aggregated profiles, serving data directly from PostgreSQL. `fast-profile.ts` implements a stale-while-revalidate like behavior by returning cached data first, then updating in the background if necessary.
- **Unique Constraints**: Efficient lookups using `ens_name` in `cached_profiles` and `[address, service]` in `service_cache`.
- **Indexes**: Appropriate indexing on `service_cache` (address, service, expires_at) and other tables improves query performance.
- **Selective Queries**: Only necessary fields retrieved.
- **Connection Pooling**: Efficient database resource usage via Prisma.

## Security Considerations

### Input Validation
- **ENS Name Validation**: Type checking and sanitization
- **Method Restrictions**: Proper HTTP method enforcement
- **Query Parameter Validation**: Required parameter checking

### Database Security
- **Parameterized Queries**: Prisma ORM prevents SQL injection
- **Environment Variables**: Sensitive data stored in environment
- **Connection Security**: Secure database connection strings

## Deployment Architecture

### Production Considerations
- **Environment Variables**: `DATABASE_URL`, `NEXT_PUBLIC_BASE_URL`
- **Database**: PostgreSQL instance required
- **Static Assets**: Next.js optimization for static files
- **API Routes**: Serverless function deployment compatible

### Scalability Features
- **Stateless API**: Horizontal scaling of Next.js API routes is possible.
- **Database Caching**: Use of `service_cache` and `cached_profiles` reduces load on external ENS/service APIs and speeds up responses.
- **Asynchronous Background Processing**: `fast-profile.ts` updates stale cache entries in the background without blocking the initial user request.
- **CDN Ready**: Static assets are optimized for CDN deployment.

## Future Architecture Considerations

### Potential Enhancements
- **Redis Caching**: Additional caching layer for high traffic
- **Queue System**: Background job processing for profile updates
- **Multi-chain Support**: Expansion beyond Ethereum mainnet
- **API Rate Limiting**: Protection against abuse
- **Real-time Updates**: WebSocket integration for live profile updates 