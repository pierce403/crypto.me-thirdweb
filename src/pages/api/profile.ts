import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { createEnsPublicClient } from '@ensdomains/ensjs';
import { http } from 'viem';
import { mainnet } from 'viem/chains';

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
    console.log(`[DEBUG] Starting ENS resolution for: ${ens_name}`);
    const address = await ensClient.getAddressRecord({ name: ens_name });
    console.log(`[DEBUG] Raw ENS response:`, JSON.stringify(address, null, 2));
    console.log(`[DEBUG] address?.value:`, address?.value);
    console.log(`[DEBUG] typeof address:`, typeof address);
    console.log(`[DEBUG] address null check:`, address === null);
    console.log(`[DEBUG] address undefined check:`, address === undefined);

    if (!address || !address.value || address.value === '0x0000000000000000000000000000000000000000') {
      console.log(`[DEBUG] ENS resolution failed - invalid or null address`);
      await prisma.cached_profiles.delete({
        where: { ens_name },
      }).catch((e) => console.log('[DEBUG] Delete error:', e));
      return res.status(404).json({ error: 'ENS name not found' });
    }

    let profile = await prisma.cached_profiles.findUnique({
      where: { ens_name },
    });

    const shouldRefresh = refresh === 'true' || !profile;

    if (shouldRefresh) {
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
    await prisma.cached_profiles.delete({
      where: { ens_name },
    }).catch(() => { });
    res.status(500).json({ error: 'Error fetching profile' });
  }
}