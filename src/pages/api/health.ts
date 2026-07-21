import type { NextApiRequest, NextApiResponse } from 'next';
import { withPrisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');

  try {
    await withPrisma((prisma) => prisma.cached_profiles.count());
    return res.status(200).json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'healthcheck_database_failed',
      error: error instanceof Error ? error.message : String(error),
    }));
    return res.status(503).json({ status: 'unhealthy', database: 'unavailable' });
  }
}
