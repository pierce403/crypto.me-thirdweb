import { useState, useEffect, useCallback, useRef } from 'react';

import { FastProfileData, SERVICES_CONFIG } from '../lib/cacheStore';


interface UseFastProfileOptions {
  pollInterval?: number; // How often to check for updates (default: 30 seconds)
  initialPollDelay?: number; // Initial delay before first poll (default: 10 seconds)
  enablePolling?: boolean; // Whether to enable automatic polling (default: true)
  minPollInterval?: number; // Minimum interval between polls (default: 10 seconds)
  maxPollInterval?: number; // Maximum interval between polls (default: 5 minutes)
}

export function useFastProfile(
  address: string | null,
  options: UseFastProfileOptions = {},
  originalInput?: string // Add optional parameter for ENS name
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
  const maxPollInterval = options.maxPollInterval || 300000; // 5 minutes default

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
      // Reschedule if we skipped
      if (enablePolling) {
        pollTimeoutRef.current = setTimeout(() => fetchData(true), minPollInterval - timeSinceLastPoll + 100);
      }
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
      currentIntervalRef.current = pollInterval;

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

    } catch (err) {
      console.error('Fetch error:', err);
      // Backoff logic
      if (isPolling) {
        consecutiveErrorsRef.current += 1;
        const errors = consecutiveErrorsRef.current;
        const base = pollInterval;
        const factor = Math.min(errors, 5); // cap
        currentIntervalRef.current = Math.min(
          maxPollInterval,
          base * Math.pow(2, factor),
        );
        console.log(`⚠️ Polling error ${errors}. Backing off to ${currentIntervalRef.current}ms`);
      }
    } finally {
      if (!isPolling) setLoading(false);

      // Schedule next poll
      if (enablePolling && isPolling) {
        if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = setTimeout(() => fetchData(true), currentIntervalRef.current);
      }
    }
  }, [address, minPollInterval, pollInterval, enablePolling, maxPollInterval]);

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

  // Manual refresh function for individual services
  const refreshService = useCallback(async (serviceName: string) => {
    if (!address) return;

    console.log(`🔄 Manual refresh triggered for service ${serviceName} on ${address}`);

    try {
      // Find the service config


      const serviceConfig = SERVICES_CONFIG.find(s => s.name === serviceName);
      if (!serviceConfig) {
        console.error(`Service ${serviceName} not found`);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const serviceUrl = serviceConfig.url(address, originalInput);
      console.log(`[refresh-service:${serviceName}] Fetching URL: ${serviceUrl}`);

      // Use relative URL - browser will automatically use current domain
      const response = await fetch(serviceUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'CryptoMe-ManualRefresh/1.0' }
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        console.log(`[refresh-service:${serviceName}] Success`);
        // Refresh the full profile to get updated data
        fetchData(false);
      } else {
        console.error(`[refresh-service:${serviceName}] Failed with status ${response.status}`);
      }
    } catch (error) {
      console.error(`[refresh-service:${serviceName}] Error:`, error);
    }
  }, [address, fetchData, originalInput]);

  // Helper to get service data
  const getServiceData = useCallback((service: string) => {
    const result = data?.services?.[service as keyof typeof data.services] || null;
    console.log(`🔍 getServiceData("${service}"):`, result);
    return result;
  }, [data]);

  // Helper to get service error info
  const getServiceError = useCallback((service: string) => {
    const result = data?.serviceErrors?.[service] || null;
    console.log(`🔍 getServiceError("${service}"):`, result);
    return result;
  }, [data]);

  // Helper to get service timestamp
  const getServiceTimestamp = useCallback((service: string) => {
    const result = data?.serviceTimestamps?.[service] || null;
    console.log(`🔍 getServiceTimestamp("${service}"):`, result);
    return result;
  }, [data]);

  // Helper to check if any service has data
  const hasAnyData = useCallback(() => {
    if (!data) return false;
    return data.cacheStatus !== 'miss';
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
    refreshService,
    getServiceData,
    getServiceError,
    getServiceTimestamp,
    hasAnyData,
    getCacheStats,

    // Individual service helpers
    ens: getServiceData('ens'),
    xmtp: getServiceData('xmtp'),
    farcaster: getServiceData('farcaster'),
    alchemy: getServiceData('alchemy'),
    opensea: getServiceData('opensea'),
    debank: getServiceData('debank'),
    icebreaker: getServiceData('icebreaker'),
    gitcoinPassport: getServiceData('gitcoin-passport'),
    decentraland: getServiceData('decentraland'),
  };
}
