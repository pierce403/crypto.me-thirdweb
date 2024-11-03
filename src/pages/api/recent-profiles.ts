import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const recentProfiles = await prisma.cached_profiles.findMany({
        where: {
          last_sync_status: {
            contains: 'Successfully updated',
          },
        },
        orderBy: {
          updated_at: 'desc',
        },
        take: 10,
        select: {
          ens_name: true,
        },
      });

      const profileNames = recentProfiles.map(profile => profile.ens_name);

      res.status(200).json({ profiles: profileNames });
    } catch (error) {
      console.error('Error fetching recent profiles:', error);
      res.status(500).json({ error: 'Failed to fetch recent profiles' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
