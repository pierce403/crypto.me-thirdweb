import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';
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

    const shouldRefresh = refresh === 'true' || !profile;

    if (shouldRefresh) {
      console.log(`Syncing profile for ${ens_name}`);
      const address = await ensClient.getAddressRecord({ name: ens_name });
      console.log(`Address for ${ens_name}:`, address);
      
      const avatarRecord = await ensClient.getTextRecord({ name: ens_name, key: 'avatar' });
      const avatar = avatarRecord?.value || null;
      console.log(`Avatar for ${ens_name}:`, avatar);
      
      const profileData = {
        ens_name,
        address: address?.value || 'Address not found',
        avatar: avatar,
        // Add more fields as you expand the profile data
      };

      console.log(`Updating/creating profile for ${ens_name}`);
      const newLastSyncStatus = `Successfully ${profile ? 'updated' : 'created'} at ${new Date().toISOString()}`;
      
      profile = await prisma.cached_profiles.upsert({
        where: { ens_name },
        update: {
          profile_data: JSON.stringify(profileData),
          updated_at: new Date(),
          last_sync_status: newLastSyncStatus
        },
        create: {
          ens_name,
          profile_data: JSON.stringify(profileData),
          last_sync_status: newLastSyncStatus
        },
      });
    }

    const parsedProfileData = typeof profile.profile_data === 'string'
      ? JSON.parse(profile.profile_data)
      : profile.profile_data;

    res.status(200).json({
      ...parsedProfileData,
      last_sync_status: profile.last_sync_status
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    console.log('Node.js version:', process.version);
    console.log('Prisma version:', Prisma.prismaVersion.client);

    try {
      console.log(`Updating last_sync_status for ${ens_name} due to error`);
      const newLastSyncStatus = `Error: ${errorMessage}`;
      await prisma.cached_profiles.upsert({
        where: { ens_name },
        update: {
          last_sync_status: newLastSyncStatus,
          updated_at: new Date()
        },
        create: {
          ens_name,
          profile_data: '{}',
          last_sync_status: newLastSyncStatus,
          updated_at: new Date()
        },
      });
      console.log(`Updated last_sync_status for ${ens_name} to:`, newLastSyncStatus);
    } catch (dbError: unknown) {
      console.error('Error updating last_sync_status:', dbError);
      console.error('Error details:', JSON.stringify(dbError, null, 2));
      if (dbError instanceof Error) {
        console.error('Stack trace:', dbError.stack);
      } else {
        console.error('Stack trace unavailable: dbError is not an instance of Error');
      }
    }
    res.status(500).json({ error: 'Internal server error', last_sync_status: `Error: ${errorMessage}` });
  }
}