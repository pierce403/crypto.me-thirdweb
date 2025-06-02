export interface FastProfileData {
  address: string;
  services: {
    ens?: Record<string, unknown> | null;
    farcaster?: Record<string, unknown> | null;
    opensea?: Record<string, unknown> | null;
    icebreaker?: Record<string, unknown> | null;
    'gitcoin-passport'?: Record<string, unknown> | null;
    decentraland?: Record<string, unknown> | null;
  };
  lastContentUpdate: string;
  cacheStatus: 'hit' | 'miss' | 'partial';
  source: string;
  loadTime: number;
  error?: string; // Optional error field
}

export interface CacheEntry {
  data: FastProfileData;
  timestamp: number; 
  backgroundFetchInProgress: boolean;
  lastBackgroundFetch: number;
}

export const profileCache = new Map<string, CacheEntry>();
export const globalFetchLock = new Map<string, Promise<void>>();

export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
export const BACKGROUND_FETCH_COOLDOWN = 30 * 1000; // 30 seconds between background fetches
export const MIN_FETCH_INTERVAL = 10 * 1000; // 10 seconds minimum between ANY fetches for same address

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