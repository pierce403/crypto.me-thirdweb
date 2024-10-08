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
    console.log(`Fetching profile for ${ens_name}`);
    let profile = await prisma.cached_profiles.findUnique({
      where: { ens_name },
    });

    console.log(`Profile for ${ens_name}:`, profile);

    const shouldRefresh = refresh === 'true' || !profile;

    if (shouldRefresh) {
      console.log(`Syncing profile for ${ens_name}`);
      const address = await ensClient.getAddressRecord({ name: ens_name });
      console.log(`Address for ${ens_name}:`, address);

      const avatarRecord = await ensClient.getTextRecord({ name: ens_name, key: 'avatar' });
      const avatar = typeof avatarRecord === 'string' ? avatarRecord : null;
      console.log(`Avatar for ${ens_name}:`, avatar);

      const profileData = {
        ens_name,
        address: address?.value || 'Address not found',
        profile_data: {
          ens_avatar: avatar,
        },
        last_sync_status: `Successfully updated at ${new Date().toISOString()}`,
      };

      console.log(`Updating/creating profile for ${ens_name}`);
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

    // Ensure profile_data is parsed as an object
    const parsedProfileData = JSON.parse(profile?.profile_data ?? '{}');

    res.status(200).json({
      ...parsedProfileData,
      last_sync_status: profile?.last_sync_status ?? 'Unknown'
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
}