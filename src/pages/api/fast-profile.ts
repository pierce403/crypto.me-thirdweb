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
}>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const BACKGROUND_FETCH_COOLDOWN = 30 * 1000; // 30 seconds between background fetches

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

// Background fetch to populate real data
async function backgroundFetchRealData(address: string): Promise<void> {
  const cached = profileCache.get(address.toLowerCase());
  if (!cached) return;

  // Mark background fetch as in progress
  cached.backgroundFetchInProgress = true;

  try {
    console.log(`🔄 Starting background fetch for ${address}`);
    
    // Fetch real data from existing APIs (in parallel, don't await)
    const services = [
      { name: 'farcaster', url: `/api/services/farcaster?address=${address}` },
      { name: 'icebreaker', url: `/api/services/icebreaker?address=${address}` },
      // Add more services as needed
    ];

    // Start all fetches in parallel without waiting
    const fetchPromises = services.map(async service => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}${service.url}`);
        if (response.ok) {
          const data = await response.json();
          
          // Update cache with real data
          const currentCached = profileCache.get(address.toLowerCase());
          if (currentCached) {
            currentCached.data.services[service.name as keyof typeof currentCached.data.services] = data;
            currentCached.data.lastContentUpdate = new Date().toISOString();
            currentCached.data.cacheStatus = 'hit';
            currentCached.timestamp = Date.now();
            
            console.log(`✅ Updated ${service.name} data for ${address}`);
          }
        }
      } catch (error) {
        console.log(`❌ Failed to fetch ${service.name} for ${address}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    });

    // Don't await - let them run in background
    Promise.all(fetchPromises).finally(() => {
      const finalCached = profileCache.get(address.toLowerCase());
      if (finalCached) {
        finalCached.backgroundFetchInProgress = false;
      }
      console.log(`🏁 Background fetch completed for ${address}`);
    });

  } catch (error) {
    console.error(`Background fetch error for ${address}:`, error);
    cached.backgroundFetchInProgress = false;
  }
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
      
      // Trigger background refresh if not already in progress
      if (!cached.backgroundFetchInProgress && (now - cached.timestamp) > BACKGROUND_FETCH_COOLDOWN) {
        backgroundFetchRealData(normalizedAddress);
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
    });

    // Start background fetch
    backgroundFetchRealData(normalizedAddress);

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