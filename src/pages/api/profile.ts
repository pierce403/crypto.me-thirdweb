import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ens_name } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!ens_name || typeof ens_name !== 'string') {
    return res.status(400).json({ error: 'Invalid ENS name' });
  }

  try {
    // Fetch profile data from the database using Prisma
    const profile = await prisma.cached_profiles.findFirst({
      where: {
        ens_name: ens_name
      }
    });

    if (profile) {
      res.status(200).json(profile.profile_data);
    } else {
      res.status(404).json({ error: 'Profile not found' });
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await prisma.$disconnect();
  }
}
