import { NextApiRequest, NextApiResponse } from 'next';
import {
  globalFetchLock,
  recentUpdatesLog,
  // CacheEntry, // Removed unused import
  RecentUpdateEvent
} from '../../lib/cacheStore';

interface QueueStatus {
  currentlyFetching: { address: string; startTime?: number }[]; // startTime might be hard to get accurately without more changes
  recentUpdates: RecentUpdateEvent[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<QueueStatus | { error: string }>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const currentlyFetching: { address: string }[] = [];
    
    // Check globalFetchLock for addresses actively being fetched
    for (const address of globalFetchLock.keys()) {
      currentlyFetching.push({ address });
    }
    
    // Alternatively, or in addition, check profileCache for backgroundFetchInProgress flag
    // This might catch fetches initiated but not yet in globalFetchLock or vice-versa depending on exact logic flow
    // For simplicity, let's stick to globalFetchLock for "actively being fetched by a promise"
    // and profileCache's backgroundFetchInProgress for "marked as fetching"
    // profileCache has been removed, so the iteration below is no longer needed.
    // globalFetchLock is now the sole source for "currentlyFetching".

    const updatesToShow = recentUpdatesLog.slice(0, 10); // Show 10 most recent

    res.status(200).json({
      currentlyFetching,
      recentUpdates: updatesToShow,
    });

  } catch (error) {
    console.error('Error in /api/queue:', error);
    res.status(500).json({ error: 'Failed to retrieve queue status' });
  }
} 