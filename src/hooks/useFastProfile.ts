import { useState, useEffect, useCallback, useRef } from 'react';

interface FastProfileData {
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
}

interface UseFastProfileOptions {
  pollInterval?: number; // How often to check for updates (default: 30 seconds)
  initialPollDelay?: number; // Initial delay before first poll (default: 10 seconds)
  enablePolling?: boolean; // Whether to enable automatic polling (default: true)
}

export function useFastProfile(
  address: string | null, 
  options: UseFastProfileOptions = {}
) {
  const {
    pollInterval = 30000, // 30 seconds
    initialPollDelay = 10000, // 10 seconds
    enablePolling = true
  } = options;

  const [data, setData] = useState<FastProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPollRef = useRef<number>(0);

  const fetchData = useCallback(async (isPolling = false) => {
    if (!address) return;

    try {
      if (!isPolling) setLoading(true);
      
      const response = await fetch(`/api/fast-profile?address=${address}`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch profile');
      }
      
      // Always update on initial load, or if we got newer data during polling
      if (!isPolling || !data || result.lastContentUpdate !== lastUpdate) {
        setData(result);
        setLastUpdate(result.lastContentUpdate);
        setError(null);
      }
      
      lastPollRef.current = Date.now();
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to fetch fast profile:', errorMessage);
      
      if (!isPolling) {
        setError(errorMessage);
      }
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [address, data, lastUpdate]);

  // Initial load
  useEffect(() => {
    if (address) {
      setLoading(true);
      setError(null);
      setData(null);
      setLastUpdate(null);
      fetchData(false);
    }
  }, [address, fetchData]);

  // Polling setup
  useEffect(() => {
    if (!address || !enablePolling) return;

    // Clear existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Set up polling with initial delay
    const startPolling = () => {
      pollIntervalRef.current = setInterval(() => {
        // Don't poll too frequently
        const timeSinceLastPoll = Date.now() - lastPollRef.current;
        if (timeSinceLastPoll >= pollInterval - 1000) {
          fetchData(true);
        }
      }, pollInterval);
    };

    // Start polling after initial delay
    const delayTimeout = setTimeout(startPolling, initialPollDelay);

    return () => {
      clearTimeout(delayTimeout);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [address, enablePolling, pollInterval, initialPollDelay, fetchData]);

  // Manual refresh function
  const refresh = useCallback(() => {
    if (address) {
      fetchData(false);
    }
  }, [address, fetchData]);

  // Helper to get service data
  const getServiceData = useCallback((service: string) => {
    return data?.services?.[service as keyof typeof data.services] || null;
  }, [data]);

  // Helper to check if any service has data
  const hasAnyData = useCallback(() => {
    if (!data?.services) return false;
    return Object.values(data.services).some(service => service !== null);
  }, [data]);

  // Helper to get cache stats
  const getCacheStats = useCallback(() => {
    return {
      source: data?.source || 'unknown',
      loadTime: data?.loadTime || 0,
      lastUpdate: lastUpdate || null,
      cacheStatus: data?.cacheStatus || 'miss',
    };
  }, [data, lastUpdate]);

  return {
    data,
    loading,
    error,
    lastUpdate,
    refresh,
    getServiceData,
    hasAnyData,
    getCacheStats,
    
    // Individual service helpers
    ens: getServiceData('ens'),
    farcaster: getServiceData('farcaster'),
    opensea: getServiceData('opensea'),
    icebreaker: getServiceData('icebreaker'),
    gitcoinPassport: getServiceData('gitcoin-passport'),
    decentraland: getServiceData('decentraland'),
  };
} 