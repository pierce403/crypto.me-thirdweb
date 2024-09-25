import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';
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
    // Fetch profile data from the database using Prisma
    let profile = await prisma.cached_profiles.findFirst({
      where: {
        ens_name: ens_name
      }
    });

    if (profile) {
      res.status(200).json(profile.profile_data);
    } else {
      // Profile not found, attempt to look up ENS name
      try {
        const address = await ensClient.getAddressRecord({ name: ens_name });
        if (address) {
          // ENS name resolved, create a new profile
          const newProfile = {
            ens_name: ens_name,
            profile_data: {
              address: address,
              // Add any other default profile data here
            }
          };

          try {
            // Save the new profile to the database
            profile = await prisma.cached_profiles.create({
              data: newProfile
            });

            res.status(200).json(profile.profile_data);
          } catch (dbError) {
            console.error('Error saving new profile to database:', dbError);
            res.status(500).json({ error: 'Failed to save new profile', details: 'Database operation failed' });
          }
        } else {
          res.status(404).json({ error: 'ENS name not found', details: 'The provided ENS name does not resolve to an address' });
        }
      } catch (ensError) {
        console.error('Error looking up ENS name:', ensError);
        res.status(404).json({ error: 'ENS name lookup failed', details: 'Unable to resolve the provided ENS name' });
      }
    }
  } catch (error) {
    console.error('Error fetching or creating profile:', error);
    if (error instanceof PrismaClient.PrismaClientKnownRequestError) {
      res.status(500).json({ error: 'Database error', details: 'An error occurred while querying the database' });
    } else {
      res.status(500).json({ error: 'Internal server error', details: 'An unexpected error occurred' });
    }
  } finally {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error('Error disconnecting from Prisma:', disconnectError);
    }
  }
}
