export interface FastProfileData {
  address: string;
  services: {
    ens?: Record<string, unknown> | null;
    farcaster?: Record<string, unknown> | null;
    alchemy?: Record<string, unknown> | null;
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