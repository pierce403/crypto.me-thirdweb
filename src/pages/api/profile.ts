import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { createEnsPublicClient } from '@ensdomains/ensjs';
import { http } from 'viem';
import { mainnet } from 'viem/chains';

const prisma = new PrismaClient();
const ensClient = createEnsPublicClient({
  chain: mainnet,
  transport: http(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ens_name } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!ens_name || typeof ens_name !== 'string') {
    return res.status(400).json({ error: 'Invalid ENS name' });
  }

  try {
    let profile = await prisma.cached_profiles.findUnique({
      where: { ens_name },
    });

    if (!profile || (profile.updated_at && new Date(profile.updated_at) < new Date(Date.now() - 3600000))) {
      const address = await ensClient.getAddressRecord({ name: ens_name });
      const profileData = {
        ens_name,
        address: address || 'Address not found',
        // Add more fields as you expand the profile data
      };

      profile = await prisma.cached_profiles.upsert({
        where: { ens_name },
        update: { profile_data: profileData, updated_at: new Date() },
        create: { ens_name, profile_data: profileData },
      });
    }

    res.status(200).json(profile.profile_data);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
