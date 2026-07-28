export interface FastProfileData {
  address: string;
  services: {
    ens?: Record<string, unknown> | null;
    xmtp?: Record<string, unknown> | null;
    farcaster?: Record<string, unknown> | null;
    alchemy?: Record<string, unknown> | null;
    opensea?: Record<string, unknown> | null;
    debank?: Record<string, unknown> | null;
    zerion?: Record<string, unknown> | null;
    icebreaker?: Record<string, unknown> | null;
    'gitcoin-passport'?: Record<string, unknown> | null;
    decentraland?: Record<string, unknown> | null;
  };
  serviceErrors?: {
    [serviceName: string]: {
      lastError: string;
      errorCount: number;
      lastAttempt: string;
    };
  };
  serviceTimestamps?: {
    [serviceName: string]: string;
  };
  lastContentUpdate: string;
  cacheStatus: 'hit' | 'miss' | 'partial';
  source: string;
  loadTime: number;
  error?: string; // Optional error field
}

export interface RecentUpdateEvent {
  address: string;
  timestamp: number;
  status: 'fetch_started' | 'fetch_completed' | 'fetch_failed' | 'service_updated' | 'service_failed';
  serviceName?: string;
  message?: string;
  errorName?: string; // Added field for error name (e.g., TypeError, HTTPError500)
}

export function addRecentUpdateEvent(eventData: Omit<RecentUpdateEvent, 'timestamp'>): void {
  const event = { ...eventData, timestamp: Date.now() };
  console.log(JSON.stringify({ event: 'profile_cache_event', ...event }));
}

export const SERVICES_CONFIG = [
  {
    name: 'ens',
    key: 'ens',
    defaultData: {},
    timeoutMs: 20000,
    url: (address: string) => `/api/services/ens?address=${address}`
  },
  {
    name: 'xmtp',
    key: 'xmtp',
    defaultData: { inboxId: null, connectedIdentities: [], identities: [] },
    // Covers a Container cold start plus the collector's bounded lookup.
    timeoutMs: 36000,
    url: (address: string) => `/api/services/xmtp?address=${address}`
  },
  {
    name: 'farcaster',
    key: 'farcaster',
    defaultData: null,
    timeoutMs: 15000,
    url: (address: string) => `/api/services/farcaster?address=${address}`
  },
  {
    name: 'alchemy',
    key: 'alchemy',
    defaultData: {
      schemaVersion: 4,
      totalValueUsd: 0,
      totalHoldings: 0,
      topHoldings: [],
      networks: [],
      source: 'none',
      isPartial: true,
      valueSemantics: 'unavailable',
      scanComplete: false,
      nativeComplete: false,
      pagesFetched: 0,
      incompleteNetworks: [],
      networkScans: {},
      requiresEtherscanApiKey: false
    },
    timeoutMs: 20000,
    url: (address: string) => `/api/services/alchemy?address=${address}`
  },
  {
    name: 'opensea',
    key: 'opensea',
    defaultData: {
      schemaVersion: 2,
      profileUrl: '',
      topValuedNFTs: [],
      nftPreview: [],
      valuationStatus: 'unavailable',
      marketStats: { totalEstimatedValue: 0, totalFloorValue: 0, uniqueCollections: 0, totalNFTs: 0, topCollectionsByValue: [] },
      portfolioSummary: { totalValue: 0, currency: 'USD', valueSource: 'unavailable', isPartial: true, lastUpdated: '' },
      source: 'none'
    },
    timeoutMs: 25000,
    url: (address: string) => `/api/services/opensea?address=${address}`
  },
  {
    name: 'debank',
    key: 'debank',
    defaultData: {
      totalUSD: 0,
      totalTokens: 0,
      totalProtocols: 0,
      topTokens: [],
      protocolPositions: [],
      portfolioUrl: '',
      lastUpdated: '',
      source: 'none'
    },
    timeoutMs: 20000,
    url: (address: string) => `/api/services/debank?address=${address}`
  },
  {
    name: 'zerion',
    key: 'zerion',
    defaultData: null,
    timeoutMs: 20000,
    url: (address: string) => `/api/services/zerion?address=${address}`
  },
  {
    name: 'icebreaker',
    key: 'icebreaker',
    defaultData: null,
    timeoutMs: 20000,
    url: (address: string, originalInput?: string) => `/api/services/icebreaker?address=${originalInput || address}`
  },
  {
    name: 'gitcoin-passport',
    key: 'gitcoin-passport',
    defaultData: {},
    timeoutMs: 20000,
    url: (address: string) => `/api/services/gitcoin-passport?address=${address}`
  },
  {
    name: 'decentraland',
    key: 'decentraland',
    defaultData: {},
    timeoutMs: 30000,
    url: (address: string) => `/api/services/decentraland?address=${address}`
  },
] as const;

export type ServiceName = (typeof SERVICES_CONFIG)[number]['name'];

export function hasOutdatedServicePayload(service: ServiceName, payload: unknown): boolean {
  if (service !== 'opensea' && service !== 'alchemy') return false;
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return true;
  const schemaVersion = (payload as Record<string, unknown>).schemaVersion;
  return service === 'alchemy' ? schemaVersion !== 4 : schemaVersion !== 2;
}
