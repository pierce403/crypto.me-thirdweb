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
  const { ens_name, refresh } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!ens_name || typeof ens_name !== 'string') {
    return res.status(400).json({ error: 'Invalid ENS name' });
  }

  try {
    // First check if ENS resolves
    const address = await ensClient.getAddressRecord({ name: ens_name });
    if (!address?.value) {
      // If ENS doesn't resolve, delete any existing profile and return 404
      await prisma.cached_profiles.delete({
        where: { ens_name },
      }).catch(() => {}); // Ignore delete errors
      return res.status(404).json({ error: 'ENS name not found' });
    }

    console.log(`Fetching profile for ${ens_name}`);
    let profile = await prisma.cached_profiles.findUnique({
      where: { ens_name },
    });

    const shouldRefresh = refresh === 'true' || !profile;

    if (shouldRefresh) {
      console.log(`Syncing profile for ${ens_name}`);
      const avatarRecord = await ensClient.getTextRecord({ name: ens_name, key: 'avatar' });
      const avatar = typeof avatarRecord === 'string' ? avatarRecord : null;

      const profileData = {
        ens_name,
        address: address.value,
        profile_data: {
          ens_avatar: avatar,
        },
        last_sync_status: `Successfully updated at ${new Date().toISOString()}`,
      };

      profile = await prisma.cached_profiles.upsert({
        where: { ens_name },
        update: {
          profile_data: JSON.stringify(profileData),
          updated_at: new Date(),
          last_sync_status: profileData.last_sync_status
        },
        create: {
          ens_name,
          profile_data: JSON.stringify(profileData),
          last_sync_status: profileData.last_sync_status
        },
      });
    }

    const parsedProfileData = JSON.parse(profile?.profile_data ?? '{}');

    res.status(200).json({
      ...parsedProfileData,
      last_sync_status: profile?.last_sync_status ?? 'Unknown'
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    
    // Delete the profile from the database on any error
    if (ens_name) {
      await prisma.cached_profiles.delete({
        where: { ens_name },
      }).catch(() => {}); // Ignore delete errors
    }
    
    res.status(500).json({ error: 'Error fetching profile' });
  }
}