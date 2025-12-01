# Crypto.me Thirdweb - Features

## Features

### Fast Profile Aggregation
- **Stability**: stable
- **Description**: Aggregates profile data from multiple external services (ENS, Farcaster, Alchemy, etc.) into a single cached response.
- **Properties**:
  - Fetches data in the background to avoid blocking the UI.
  - Caches results in a PostgreSQL database (`service_cache` table).
  - Returns cached data immediately if available ("stale-while-revalidate" pattern).
- **Test Criteria**:
  - [x] `/api/fast-profile?address=...` returns JSON with `services` object.
  - [x] Cache status (`hit`, `miss`, `partial`) is correctly reported.
  - [x] Background fetch is triggered on cache miss or stale data.

### ENS Resolution & Validation
- **Stability**: stable
- **Description**: Resolves ENS names to Ethereum addresses and validates input names.
- **Properties**:
  - Uses `@adraffy/ens-normalize` for standard ENS normalization.
  - Supports direct Ethereum address input (0x...).
  - Resolves avatars and other text records.
- **Test Criteria**:
  - [x] Valid ENS names (e.g., `vitalik.eth`) resolve to addresses.
  - [x] Invalid names are rejected.
  - [x] 0x addresses are accepted and resolve reverse records if available.

### Service Polling with Backoff
- **Stability**: stable
- **Description**: Client-side polling mechanism to keep profile data fresh without overwhelming the server.
- **Properties**:
  - Polls `/api/fast-profile` at defined intervals.
  - Implements exponential backoff on consecutive errors.
  - Reschedules polling dynamically based on server response.
- **Test Criteria**:
  - [x] Polling stops after `maxPollInterval` is reached on errors.
  - [x] Successful fetch resets the error count and polling interval.
  - [x] Manual refresh triggers an immediate fetch.

### Identity Summary
- **Stability**: stable
- **Description**: A summary section at the top of the profile page displaying key aggregated metrics.
- **Properties**:
  - Shows total ENS names owned.
  - Displays Farcaster username and follower count.
  - Shows Gitcoin Passport score.
  - Displays estimated Net Worth from DeBank.
- **Test Criteria**:
  - [x] Summary box appears when data is available.
  - [x] Metrics match the data in individual service cards.

### Service Cards
- **Stability**: stable
- **Description**: Individual UI components for displaying data from specific services.
- **Properties**:
  - **ENS**: Domains owned, avatar.
  - **Farcaster**: Profile info, stats.
  - **Alchemy**: NFT counts, collections.
  - **OpenSea**: Portfolio value, top NFTs.
  - **DeBank**: DeFi portfolio, token balances.
  - **Icebreaker**: Professional credentials.
  - **Gitcoin Passport**: Sybil resistance score.
  - **Decentraland**: Metaverse data.
- **Test Criteria**:
  - [x] Cards render correctly with data.
  - [x] Cards show error state if specific service fails.
  - [x] "Last updated" timestamp is visible per card.

### Recent Profiles
- **Stability**: stable
- **Description**: Displays a list of recently accessed profiles on the homepage.
- **Properties**:
  - Fetches from `/api/recent-profiles`.
  - Filters out invalid names.
- **Test Criteria**:
  - [x] Homepage lists valid recently visited profiles.
  - [x] Clicking a recent profile navigates to its page.
