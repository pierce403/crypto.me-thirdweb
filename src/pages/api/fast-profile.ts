import { NextApiRequest, NextApiResponse } from 'next';

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

// Simple in-memory cache for demonstration
const profileCache = new Map<string, { 
  data: FastProfileData; 
  timestamp: number; 
  backgroundFetchInProgress: boolean;
  lastBackgroundFetch: number;
}>();

// Global rate limiting map to prevent multiple concurrent fetches
const globalFetchLock = new Map<string, Promise<void>>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const BACKGROUND_FETCH_COOLDOWN = 30 * 1000; // 30 seconds between background fetches
const MIN_FETCH_INTERVAL = 10 * 1000; // 10 seconds minimum between ANY fetches for same address

// Mock instant data (simulating what would come from database)
function getInstantProfileData(address: string): FastProfileData {
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
  
  // Check if there's already a fetch in progress for this address
  if (globalFetchLock.has(normalizedAddress)) {
    console.log(`🚫 Background fetch already in progress for ${address}`);
    return;
  }

  const cached = profileCache.get(normalizedAddress);
  if (!cached) {
    console.log(`❌ No cache entry found for ${address}, skipping background fetch`);
    return;
  }

  // Check if we've fetched too recently
  const timeSinceLastFetch = now - (cached.lastBackgroundFetch || 0);
  if (timeSinceLastFetch < MIN_FETCH_INTERVAL) {
    console.log(`⏰ Skipping background fetch for ${address} - only ${timeSinceLastFetch}ms since last fetch (min: ${MIN_FETCH_INTERVAL}ms)`);
    return;
  }

  // Mark background fetch as in progress
  cached.backgroundFetchInProgress = true;
  cached.lastBackgroundFetch = now;

  // Create a promise to track this fetch operation
  const fetchPromise = (async () => {
    try {
      console.log(`🔄 Starting background fetch for ${address}`);
      
      // Fetch real data from existing APIs with timeout
      const services = [
        { name: 'farcaster', url: `/api/services/farcaster?address=${address}` },
        { name: 'icebreaker', url: `/api/services/icebreaker?address=${address}` },
      ];

      // Fetch services one by one with delays to avoid overwhelming APIs
      for (const service of services) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
          
          // Add timeout to prevent hanging requests
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          const response = await fetch(`${baseUrl}${service.url}`, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'CryptoMe-FastProfile/1.0'
            }
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const data = await response.json();
            
            // Update cache with real data
            const currentCached = profileCache.get(normalizedAddress);
            if (currentCached) {
              currentCached.data.services[service.name as keyof typeof currentCached.data.services] = data;
              currentCached.data.lastContentUpdate = new Date().toISOString();
              currentCached.data.cacheStatus = 'hit';
              currentCached.timestamp = Date.now();
              
              console.log(`✅ Updated ${service.name} data for ${address}`);
            }
          } else {
            console.log(`⚠️  Service ${service.name} returned ${response.status} for ${address}`);
          }
          
          // Add small delay between service calls to be respectful
          if (services.indexOf(service) < services.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
          }
          
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            console.log(`⏱️  ${service.name} request timed out for ${address}`);
          } else {
            console.log(`❌ Failed to fetch ${service.name} for ${address}:`, error instanceof Error ? error.message : 'Unknown error');
          }
        }
      }

    } catch (error) {
      console.error(`Background fetch error for ${address}:`, error);
    } finally {
      // Clean up
      const finalCached = profileCache.get(normalizedAddress);
      if (finalCached) {
        finalCached.backgroundFetchInProgress = false;
      }
      globalFetchLock.delete(normalizedAddress);
      console.log(`🏁 Background fetch completed for ${address}`);
    }
  })();

  // Store the fetch promise to prevent concurrent fetches
  globalFetchLock.set(normalizedAddress, fetchPromise);
  
  // Execute the fetch
  await fetchPromise;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { address } = req.query;
  const startTime = Date.now();

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Address is required' });
  }

  const normalizedAddress = address.toLowerCase();

  try {
    // Check cache first
    const cached = profileCache.get(normalizedAddress);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      // Return cached data immediately
      const loadTime = Date.now() - startTime;
      
      // Trigger background refresh if conditions are met
      const timeSinceLastBackground = now - (cached.lastBackgroundFetch || 0);
      const shouldTriggerBackground = !cached.backgroundFetchInProgress && 
                                    !globalFetchLock.has(normalizedAddress) &&
                                    timeSinceLastBackground > BACKGROUND_FETCH_COOLDOWN;
      
      if (shouldTriggerBackground) {
        console.log(`🔄 Triggering background refresh for ${address} (last fetch: ${timeSinceLastBackground}ms ago)`);
        // Don't await - let it run in background
        backgroundFetchRealData(normalizedAddress).catch(error => {
          console.error(`Background fetch failed for ${address}:`, error);
        });
      } else if (cached.backgroundFetchInProgress) {
        console.log(`⏳ Background fetch already in progress for ${address}`);
      } else if (globalFetchLock.has(normalizedAddress)) {
        console.log(`🔒 Global fetch lock active for ${address}`);
      } else {
        console.log(`⏰ Too soon for background fetch for ${address} (${timeSinceLastBackground}ms < ${BACKGROUND_FETCH_COOLDOWN}ms)`);
      }

      return res.status(200).json({
        ...cached.data,
        source: 'memory-cache',
        loadTime,
      });
    }

    // No cache or expired - return instant data and start background fetch
    const instantData = getInstantProfileData(normalizedAddress);
    const loadTime = Date.now() - startTime;

    // Cache the instant data
    profileCache.set(normalizedAddress, {
      data: instantData,
      timestamp: now,
      backgroundFetchInProgress: false,
      lastBackgroundFetch: 0,
    });

    // Start background fetch (don't await)
    backgroundFetchRealData(normalizedAddress).catch(error => {
      console.error(`Initial background fetch failed for ${address}:`, error);
    });

    return res.status(200).json({
      ...instantData,
      loadTime,
    });

  } catch (error) {
    console.error('Fast profile fetch error:', error);
    
    // Even on error, return basic structure
    const fallbackData = getInstantProfileData(normalizedAddress);
    
    return res.status(200).json({
      ...fallbackData,
      source: 'fallback',
      error: 'Cache temporarily unavailable',
      loadTime: Date.now() - startTime,
    });
  }
} 