import { NextApiRequest, NextApiResponse } from 'next';
import {
  profileCache,
  globalFetchLock,
  CACHE_TTL,
  BACKGROUND_FETCH_COOLDOWN,
  MIN_FETCH_INTERVAL,
  addRecentUpdateEvent,
  FastProfileData, // Import FastProfileData from the shared store
  CacheEntry
} from '../../lib/cacheStore';

// The FastProfileData interface is now imported from cacheStore, so it can be removed from here.
// interface FastProfileData { ... }

// Simple in-memory cache, global fetch lock, and constants are now imported from cacheStore.
// const profileCache = new Map<string, { ... }>();
// const globalFetchLock = new Map<string, Promise<void>>();
// const CACHE_TTL = ...;
// const BACKGROUND_FETCH_COOLDOWN = ...;
// const MIN_FETCH_INTERVAL = ...;

// Mock instant data (simulating what would come from database)
function getInstantProfileData(address: string): FastProfileData {
  // This function now returns FastProfileData from cacheStore
  return {
    address: address.toLowerCase(),
    services: {
      ens: {
        primaryName: address.endsWith('.eth') ? address : null,
        avatar: null,
        otherNames: [],
        profileUrl: `https://app.ens.domains/name/${address}`,
        lastUpdated: new Date().toISOString(),
      },
      farcaster: null, // Will be populated by background fetch
      opensea: {
        profileUrl: `https://opensea.io/${address}`,
        topNFTs: [],
        totalValue: 0,
        lastUpdated: new Date().toISOString(),
      },
      icebreaker: null, // Will be populated by background fetch
      'gitcoin-passport': {
        score: 0,
        stamps: [],
        lastUpdated: new Date().toISOString(),
        trustLevel: 'Unknown',
        error: 'NO_API_ACCESS',
      },
      decentraland: {
        profileUrl: `https://market.decentraland.org/accounts/${address}`,
        avatar: null,
        landParcels: 0,
        wearables: 0,
        lastActive: null,
        lastUpdated: new Date().toISOString(),
      },
    },
    lastContentUpdate: new Date().toISOString(),
    cacheStatus: 'partial',
    source: 'instant-cache',
    loadTime: 0,
  };
}

// Background fetch to populate real data with proper rate limiting
async function backgroundFetchRealData(address: string): Promise<void> {
  const normalizedAddress = address.toLowerCase();
  const now = Date.now();
  
  if (globalFetchLock.has(normalizedAddress)) {
    // console.log(`🚫 Background fetch already in progress for ${address}`); // Logging handled by addRecentUpdateEvent
    return;
  }

  const cached = profileCache.get(normalizedAddress);
  if (!cached) {
    // console.log(`❌ No cache entry found for ${address}, skipping background fetch`);
    addRecentUpdateEvent({ address: normalizedAddress, status: 'fetch_failed', message: 'No cache entry found for background fetch' });
    return;
  }

  const timeSinceLastFetch = now - (cached.lastBackgroundFetch || 0);
  if (timeSinceLastFetch < MIN_FETCH_INTERVAL) {
    // console.log(`⏰ Skipping background fetch for ${address} ...`);
    return;
  }
  
  addRecentUpdateEvent({ address: normalizedAddress, status: 'fetch_started' });
  cached.backgroundFetchInProgress = true;
  cached.lastBackgroundFetch = now;

  const fetchPromise = (async () => {
    try {
      // console.log(`🔄 Starting background fetch for ${address}`); // Logged above
      const services = [
        { name: 'ens', url: `/api/services/ens?address=${address}` },
        { name: 'farcaster', url: `/api/services/farcaster?address=${address}` },
        { name: 'icebreaker', url: `/api/services/icebreaker?address=${address}` },
      ];

      for (const service of services) {
        try {
          // Use VERCEL_URL in production, fallback to localhost in dev
          const baseUrl =
            process.env.NEXT_PUBLIC_BASE_URL ||
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          
          const response = await fetch(`${baseUrl}${service.url}`, {
            signal: controller.signal,
            headers: { 'User-Agent': 'CryptoMe-FastProfile/1.0' }
          });
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const data = await response.json();
            const currentCached = profileCache.get(normalizedAddress);
            if (currentCached) {
              currentCached.data.services[service.name as keyof typeof currentCached.data.services] = data;
              currentCached.data.lastContentUpdate = new Date().toISOString();
              currentCached.data.cacheStatus = 'hit'; // Or determine if still partial
              currentCached.timestamp = Date.now();
              addRecentUpdateEvent({ address: normalizedAddress, status: 'service_updated', serviceName: service.name });
            }
          } else {
            let serviceErrorMessage = `Service returned ${response.status}`;
            const errorName = `HTTPError${response.status}`;
            try {
              const errorData = await response.json();
              if (errorData.error) { // Assuming error structure like { error: "message" }
                serviceErrorMessage = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
              } else if (typeof errorData === 'string') {
                serviceErrorMessage = errorData;
              } else if (errorData.message && typeof errorData.message === 'string') {
                serviceErrorMessage = errorData.message;
              }
            } catch {
              // Failed to parse error JSON, stick with the status code message
            }
            addRecentUpdateEvent({ 
              address: normalizedAddress, 
              status: 'service_failed', 
              serviceName: service.name, 
              message: serviceErrorMessage,
              errorName: errorName
            });
          }
          if (services.indexOf(service) < services.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error('Unknown fetch error');
          const message = err.message;
          const errorName = err.name === 'AbortError' ? 'TimeoutError' : err.name;
          addRecentUpdateEvent({ 
            address: normalizedAddress, 
            status: 'service_failed', 
            serviceName: service.name, 
            message,
            errorName
          });
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Outer background fetch error');
      addRecentUpdateEvent({ 
        address: normalizedAddress, 
        status: 'fetch_failed', 
        message: err.message,
        errorName: err.name 
      });
    } finally {
      const finalCached = profileCache.get(normalizedAddress);
      if (finalCached) {
        finalCached.backgroundFetchInProgress = false;
      }
      globalFetchLock.delete(normalizedAddress);
      addRecentUpdateEvent({ address: normalizedAddress, status: 'fetch_completed' });
    }
  })();

  globalFetchLock.set(normalizedAddress, fetchPromise);
  await fetchPromise;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<FastProfileData | { error: string }>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { address } = req.query;
  const startTime = Date.now();

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Address is required' });
  }

  const normalizedAddress = address.toLowerCase();

  try {
    const cached = profileCache.get(normalizedAddress);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      const loadTime = Date.now() - startTime;
      const timeSinceLastBackground = now - (cached.lastBackgroundFetch || 0);
      const shouldTriggerBackground = !cached.backgroundFetchInProgress && 
                                    !globalFetchLock.has(normalizedAddress) &&
                                    timeSinceLastBackground > BACKGROUND_FETCH_COOLDOWN;
      
      if (shouldTriggerBackground) {
        // addRecentUpdateEvent({ address: normalizedAddress, status: 'fetch_started', message: 'Triggering background refresh from cache hit' }); // Logged in backgroundFetchRealData
        backgroundFetchRealData(normalizedAddress).catch(err => {
          const errorInstance = err instanceof Error ? err : new Error(String(err));
          addRecentUpdateEvent({ 
            address: normalizedAddress, 
            status: 'fetch_failed', 
            message: `Background refresh error: ${errorInstance.message}`,
            errorName: errorInstance.name
          });
        });
      }
      return res.status(200).json({
        ...cached.data,
        source: 'memory-cache',
        loadTime,
      });
    }

    const instantData = getInstantProfileData(normalizedAddress);
    const loadTime = Date.now() - startTime;
    
    const newCacheEntry: CacheEntry = {
        data: instantData,
        timestamp: now,
        backgroundFetchInProgress: false, // Will be set true by backgroundFetchRealData
        lastBackgroundFetch: 0, // Will be set by backgroundFetchRealData
    };
    profileCache.set(normalizedAddress, newCacheEntry);
    
    // addRecentUpdateEvent({ address: normalizedAddress, status: 'fetch_started', message: 'Initial fetch' }); // Logged in backgroundFetchRealData
    backgroundFetchRealData(normalizedAddress).catch(err => {
      const errorInstance = err instanceof Error ? err : new Error(String(err));
      addRecentUpdateEvent({ 
        address: normalizedAddress, 
        status: 'fetch_failed', 
        message: `Initial background fetch error: ${errorInstance.message}`,
        errorName: errorInstance.name
      });
    });

    return res.status(200).json({
      ...instantData,
      loadTime,
    });

  } catch (error) {
    const errorInstance = error instanceof Error ? error : new Error(String(error));
    addRecentUpdateEvent({ 
      address: normalizedAddress, 
      status: 'fetch_failed', 
      message: `Handler error: ${errorInstance.message}`,
      errorName: errorInstance.name
    });
    const fallbackData = getInstantProfileData(normalizedAddress);
    return res.status(200).json({
      ...fallbackData,
      source: 'fallback',
      error: 'Cache temporarily unavailable', // Consider more specific error
      loadTime: Date.now() - startTime,
    });
  }
} 