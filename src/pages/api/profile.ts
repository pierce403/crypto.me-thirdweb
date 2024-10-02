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
    console.log(`Fetching profile for ${ens_name}`);
    let profile = await prisma.cached_profiles.findUnique({
      where: { ens_name },
    });

    console.log(`Profile for ${ens_name}:`, profile);

    // Always update the profile to ensure last_sync_status is set
    console.log(`Syncing profile for ${ens_name}`);
    const address = await ensClient.getAddressRecord({ name: ens_name });
    console.log(`Address for ${ens_name}:`, address);
    const profileData = {
      ens_name,
      address: address || 'Address not found',
      // Add more fields as you expand the profile data
    };

    console.log(`Updating/creating profile for ${ens_name}`);
    const newLastSyncStatus = `Successfully ${profile ? 'updated' : 'created'} at ${new Date().toISOString()}`;
    console.log(`Attempting to upsert profile for ${ens_name}`);
    console.log(`Profile data:`, profileData);
    console.log(`New last_sync_status:`, newLastSyncStatus);
    try {
      console.log(`Starting upsert operation for ${ens_name}`);
      console.log(`Upsert parameters:`, {
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
      console.log(`Executing upsert operation...`);
      console.log(`Database connection status: Connected`);
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
      console.log(`Upsert operation completed for ${ens_name}`);
      console.log(`Successfully upserted profile for ${ens_name}:`, JSON.stringify(profile, null, 2));
      console.log(`Verifying last_sync_status:`, profile.last_sync_status);

      // Additional logging to verify the upsert operation
      console.log(`Fetching updated profile from database for ${ens_name}`);
      const updatedProfile = await prisma.cached_profiles.findUnique({
        where: { ens_name },
      });
      console.log(`Updated profile from database:`, JSON.stringify(updatedProfile, null, 2));
      console.log(`Comparing last_sync_status:`, {
        newLastSyncStatus,
        profileLastSyncStatus: profile.last_sync_status,
        updatedProfileLastSyncStatus: updatedProfile?.last_sync_status
      });

      // Verify database connection and last_sync_status
      console.log(`Verifying database connection...`);
      const dbConnectionTest = await prisma.$queryRaw`SELECT 1 as result`;
      console.log(`Database connection test result:`, dbConnectionTest);

      console.log(`Verifying last_sync_status in database...`);
      const verifiedProfile = await prisma.cached_profiles.findUnique({
        where: { ens_name },
        select: { last_sync_status: true }
      });
      console.log(`Verified last_sync_status:`, verifiedProfile?.last_sync_status);

      if (verifiedProfile?.last_sync_status !== newLastSyncStatus) {
        console.error(`last_sync_status mismatch for ${ens_name}:`, {
          expected: newLastSyncStatus,
          actual: verifiedProfile?.last_sync_status
        });
      }

    } catch (upsertError) {
      console.error(`Error upserting profile for ${ens_name}:`, upsertError);
      console.error(`Error details:`, JSON.stringify(upsertError, null, 2));
      console.error(`Stack trace:`, upsertError.stack);
      throw upsertError;
    }
    console.log(`Updated/created profile:`, JSON.stringify(profile, null, 2));
    console.log(`New last_sync_status:`, profile.last_sync_status);

    const parsedProfileData = typeof profile.profile_data === 'string'
      ? JSON.parse(profile.profile_data)
      : profile.profile_data;

    console.log(`Sending response for ${ens_name}:`, {
      ...parsedProfileData,
      last_sync_status: profile.last_sync_status
    });

    res.status(200).json({
      ...parsedProfileData,
      last_sync_status: profile.last_sync_status
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
    } catch (dbError) {
      console.error('Error updating last_sync_status:', dbError);
      console.error('Error details:', JSON.stringify(dbError, null, 2));
      console.error('Stack trace:', dbError.stack);
    }
    res.status(500).json({ error: 'Internal server error', last_sync_status: `Error: ${errorMessage}` });
  }
}
