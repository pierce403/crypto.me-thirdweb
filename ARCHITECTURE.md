# Crypto.me Thirdweb - Architecture Documentation

## Overview

Crypto.me Thirdweb is a Next.js-based web application that serves as a central profile page for web3 identities. It allows users to view and manage their Ethereum Name Service (ENS) profiles, displaying profile information with intelligent caching and real-time updates.

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
│           ├── profile.ts       # Profile fetching and caching logic
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
- **Purpose**: ENS profile fetching and caching management
- **Endpoint**: `GET /api/profile?ens_name={name}&refresh={boolean}`
- **Features**:
  - ENS resolution using ENS.js
  - Profile data caching in PostgreSQL
  - Automatic refresh on stale data
  - Error handling for invalid ENS names
  - IPFS avatar URL resolution

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
```sql
model cached_profiles {
  id               Int       @id @default(autoincrement())
  ens_name         String    @unique
  profile_data     String    # JSON string containing profile information
  created_at       DateTime  @default(now())
  updated_at       DateTime  @default(now())
  last_sync_status String?   # Status of last ENS sync attempt
}
```

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

### 1. Profile Page Loading Flow

```
User requests /{ens_name}
    ↓
getServerSideProps executes
    ↓
Check cached_profiles table
    ├── If cached & fresh: Return immediately
    ├── If cached & stale: Return cached + trigger background refresh
    └── If not cached: Perform full ENS lookup
         ↓
    ENS.js resolves address & avatar
         ↓
    Store in database
         ↓
    Return profile data
```

### 2. Background Refresh Strategy

```
Profile older than 1 hour detected
    ↓
Client-side fetch to /api/profile?refresh=true
    ↓
API performs fresh ENS lookup
    ↓
Database updated with new data
    ↓
Client refreshes page after 10 seconds
```

### 3. Caching Strategy

- **L1 Cache**: Database-stored JSON profile data
- **Cache Key**: ENS name (unique constraint)
- **TTL Strategy**: Time-based refresh (1 hour staleness threshold)
- **Cache Invalidation**: Manual refresh trigger via API

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
- **Unique Constraints**: Efficient ENS name lookups
- **Selective Queries**: Only necessary fields retrieved
- **Connection Pooling**: Efficient database resource usage

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
- **Stateless API**: Horizontal scaling possible
- **Database Caching**: Reduces ENS API calls
- **Background Processing**: Non-blocking profile updates
- **CDN Ready**: Static asset optimization for CDN deployment

## Future Architecture Considerations

### Potential Enhancements
- **Redis Caching**: Additional caching layer for high traffic
- **Queue System**: Background job processing for profile updates
- **Multi-chain Support**: Expansion beyond Ethereum mainnet
- **API Rate Limiting**: Protection against abuse
- **Real-time Updates**: WebSocket integration for live profile updates 