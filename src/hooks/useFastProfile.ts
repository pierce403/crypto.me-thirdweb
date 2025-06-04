import { useState, useEffect, useCallback, useRef } from 'react';

interface FastProfileData {
  address: string;
  services: {
    ens?: Record<string, unknown> | null;
    farcaster?: Record<string, unknown> | null;
    alchemy?: Record<string, unknown> | null;
    opensea?: Record<string, unknown> | null;
    debank?: Record<string, unknown> | null;
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
  minPollInterval?: number; // Minimum interval between polls (default: 10 seconds)
  maxPollInterval?: number; // Maximum interval between polls (default: 5 minutes)
}

export function useFastProfile(
  address: string | null, 
  options: UseFastProfileOptions = {}
) {
  const {
    pollInterval = 30000,
    initialPollDelay = 10000,
    enablePolling = true,
    minPollInterval = 10000,
  } = options;

  const [data, setData] = useState<FastProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  
  // Use refs to track current values without causing re-renders
  const dataRef = useRef<FastProfileData | null>(null);
  const lastUpdateRef = useRef<string | null>(null);
  
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPollRef = useRef<number>(0);
  const consecutiveErrorsRef = useRef<number>(0);
  const currentIntervalRef = useRef<number>(pollInterval);

  // Update refs when state changes
  useEffect(() => {
    dataRef.current = data;
    lastUpdateRef.current = lastUpdate;
  }, [data, lastUpdate]);

  const fetchData = useCallback(async (isPolling = false) => {
    if (!address) return;

    // Prevent too frequent polling
    const timeSinceLastPoll = Date.now() - lastPollRef.current;
    if (isPolling && timeSinceLastPoll < minPollInterval) {
      console.log(`🚫 Skipping poll - only ${timeSinceLastPoll}ms since last poll (min: ${minPollInterval}ms)`);
      return;
    }

    try {
      if (!isPolling) setLoading(true);
      
      console.log(`📡 Fetching profile data for ${address} (polling: ${isPolling})`);
      
      const response = await fetch(`/api/fast-profile?address=${address}`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch profile');
      }
      
      // Reset error counter on success
      consecutiveErrorsRef.current = 0;
      
      // Always update on initial load, or if we got newer data during polling
      const currentData = dataRef.current;
      const currentLastUpdate = lastUpdateRef.current;
      
      if (!isPolling || !currentData || result.lastContentUpdate !== currentLastUpdate) {
        setData(result);
        setLastUpdate(result.lastContentUpdate);
        setError(null);
        console.log(`✅ Updated profile data for ${address}`);
      } else {
        console.log(`📄 No new data for ${address}`);
      }
      
      lastPollRef.current = Date.now();
      
    } catch {
      // Failed to parse error JSON, stick with the status code message
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [address, minPollInterval]);

  // Initial load
  useEffect(() => {
    if (address) {
      console.log(`🚀 Initial load for ${address}`);
      setLoading(true);
      setError(null);
      setData(null);
      setLastUpdate(null);
      consecutiveErrorsRef.current = 0;
      lastPollRef.current = 0;
      fetchData(false);
    }
  }, [address, fetchData]);

  // Polling setup
  useEffect(() => {
    if (!address || !enablePolling) {
      // Clear any existing timeout
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      return;
    }

    console.log(`⏱️  Setting up polling for ${address} with ${initialPollDelay / 1000}s initial delay`);

    // Start first poll after initial delay
    const initialTimeout = setTimeout(() => {
      fetchData(true);
    }, initialPollDelay);

    return () => {
      clearTimeout(initialTimeout);
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [address, enablePolling, initialPollDelay, fetchData]);

  // Manual refresh function
  const refresh = useCallback(() => {
    if (address) {
      console.log(`🔄 Manual refresh triggered for ${address}`);
      consecutiveErrorsRef.current = 0; // Reset backoff on manual refresh
      fetchData(false);
    }
  }, [address, fetchData]);

  // Helper to get service data
  const getServiceData = useCallback((service: string) => {
    const result = data?.services?.[service as keyof typeof data.services] || null;
    console.log(`🔍 getServiceData("${service}"):`, result);
    return result;
  }, [data]);

  // Helper to check if any service has data
  const hasAnyData = useCallback(() => {
    if (!data?.services) {
      console.log(`🔍 hasAnyData: false (no data.services)`);
      return false;
    }
    const hasData = Object.values(data.services).some(service => service !== null);
    console.log(`🔍 hasAnyData:`, hasData, data.services);
    return hasData;
  }, [data]);

  // Helper to get cache stats
  const getCacheStats = useCallback(() => {
    return {
      source: data?.source || 'unknown',
      loadTime: data?.loadTime || 0,
      lastUpdate: lastUpdate || null,
      cacheStatus: data?.cacheStatus || 'miss',
      nextPollIn: pollTimeoutRef.current ? currentIntervalRef.current : null,
      errorCount: consecutiveErrorsRef.current,
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
    alchemy: getServiceData('alchemy'),
    opensea: getServiceData('opensea'),
    debank: getServiceData('debank'),
    icebreaker: getServiceData('icebreaker'),
    gitcoinPassport: getServiceData('gitcoin-passport'),
    decentraland: getServiceData('decentraland'),
  };
} 