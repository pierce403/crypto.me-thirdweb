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
    console.log(`Attempting to resolve ENS address for ${ens_name}...`);
    const address = await ensClient.getAddressRecord({ name: ens_name });
    console.log(`ENS resolution result for ${ens_name}:`, address);

    if (!address?.value) {
      console.log(`ENS resolution failed for ${ens_name} - no valid address found`);
      // If ENS doesn't resolve, delete any existing profile and return 404
      await prisma.cached_profiles.delete({
        where: { ens_name },
      }).catch((deleteError) => {
        console.log(`Failed to delete profile for ${ens_name}:`, deleteError);
      });
      return res.status(404).json({ error: 'ENS name not found' });
    }

    console.log(`Successfully resolved ${ens_name} to address ${address.value}`);
    let profile = await prisma.cached_profiles.findUnique({
      where: { ens_name },
    });

    const shouldRefresh = refresh === 'true' || !profile;
    console.log(`Should refresh profile for ${ens_name}?`, shouldRefresh, 
      `(refresh param: ${refresh}, existing profile: ${!!profile})`);

    if (shouldRefresh) {
      console.log(`Fetching avatar record for ${ens_name}...`);
      const avatarRecord = await ensClient.getTextRecord({ name: ens_name, key: 'avatar' });
      console.log(`Avatar record for ${ens_name}:`, avatarRecord);
      const avatar = typeof avatarRecord === 'string' ? avatarRecord : null;

      const profileData = {
        ens_name,
        address: address.value,
        profile_data: {
          ens_avatar: avatar,
        },
        last_sync_status: `Successfully updated at ${new Date().toISOString()}`,
      };
      console.log(`Updating profile data for ${ens_name}:`, profileData);

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
      console.log(`Profile upsert complete for ${ens_name}`);
    }

    const parsedProfileData = JSON.parse(profile?.profile_data ?? '{}');
    console.log(`Returning profile data for ${ens_name}:`, parsedProfileData);

    res.status(200).json({
      ...parsedProfileData,
      last_sync_status: profile?.last_sync_status ?? 'Unknown'
    });
  } catch (error) {
    console.error(`Error processing ${ens_name}:`, error);
    
    // Delete the profile from the database on any error
    if (ens_name) {
      console.log(`Attempting to delete failed profile for ${ens_name}`);
      await prisma.cached_profiles.delete({
        where: { ens_name },
      }).catch((deleteError) => {
        console.log(`Failed to delete profile for ${ens_name}:`, deleteError);
      });
    }
    
    res.status(500).json({ error: 'Error fetching profile' });
  }
}