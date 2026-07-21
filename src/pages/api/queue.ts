import type { NextApiRequest, NextApiResponse } from 'next';

interface QueueStatus {
  source: 'cloudflare-queue';
  currentlyFetching: never[];
  recentUpdates: never[];
  note: string;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<QueueStatus | { error: string }>,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  return res.status(200).json({
    source: 'cloudflare-queue',
    currentlyFetching: [],
    recentUpdates: [],
    note: 'Refresh work is durable in Cloudflare Queues; inspect Workers logs for job status.',
  });
}
