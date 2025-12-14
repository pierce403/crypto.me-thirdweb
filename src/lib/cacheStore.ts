export interface FastProfileData {
  address: string;
  services: {
    ens?: Record<string, unknown> | null;
    xmtp?: Record<string, unknown> | null;
    farcaster?: Record<string, unknown> | null;
    alchemy?: Record<string, unknown> | null;
    opensea?: Record<string, unknown> | null;
    debank?: Record<string, unknown> | null;
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

export const globalFetchLock = new Map<string, Promise<void>>();

// For the queue endpoint - recent updates log
export interface RecentUpdateEvent {
  address: string;
  timestamp: number;
  status: 'fetch_started' | 'fetch_completed' | 'fetch_failed' | 'service_updated' | 'service_failed';
  serviceName?: string;
  message?: string;
  errorName?: string; // Added field for error name (e.g., TypeError, HTTPError500)
}

export const recentUpdatesLog: RecentUpdateEvent[] = [];
const MAX_LOG_SIZE = 20; // Keep a bit more than 10 for buffer

export function addRecentUpdateEvent(eventData: Omit<RecentUpdateEvent, 'timestamp'>): void {
  const event = { ...eventData, timestamp: Date.now() };
  recentUpdatesLog.unshift(event);
  if (recentUpdatesLog.length > MAX_LOG_SIZE) {
    recentUpdatesLog.length = MAX_LOG_SIZE;
  }
  console.log(`[CacheStoreEvent] ${event.status} for ${event.address}` + (event.serviceName ? ` (service: ${event.serviceName})` : '') + (event.message ? ` Msg: ${event.message}` : ''));
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
    timeoutMs: 20000,
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
    defaultData: { totalCount: 0, nfts: [], collections: {}, source: 'none' },
    timeoutMs: 20000,
    url: (address: string) => `/api/services/alchemy?address=${address}`
  },
  {
    name: 'opensea',
    key: 'opensea',
    defaultData: {
      profileUrl: '',
      topValuedNFTs: [],
      marketStats: { totalEstimatedValue: 0, totalFloorValue: 0, uniqueCollections: 0, totalNFTs: 0, topCollectionsByValue: [] },
      portfolioSummary: { totalValue: 0, currency: 'ETH', lastUpdated: '' },
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
