import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { createEnsPublicClient } from '@ensdomains/ensjs';
import { http } from 'viem';
import { mainnet } from 'viem/chains';

const alchemyRpcUrl =
  process.env.ALCHEMY_RPC_URL ||
  (process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined);

const ensClient = createEnsPublicClient({
  chain: mainnet,
  transport: http(alchemyRpcUrl, { timeout: 8000, retryCount: 1, retryDelay: 300 }),
});

const PROFILE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function isProfileStale(profile: { next_sync_due: Date | null; updated_at: Date }): boolean {
  if (profile.next_sync_due && profile.next_sync_due.getTime() <= Date.now()) return true;
  return Date.now() - profile.updated_at.getTime() > PROFILE_TTL_MS;
}

async function refreshEnsProfile(ens_name: string): Promise<void> {
  const addressRecord = await ensClient.getAddressRecord({ name: ens_name });
  if (!addressRecord?.value || addressRecord.value === '0x0000000000000000000000000000000000000000') {
    await prisma.cached_profiles
      .delete({
        where: { ens_name },
      })
      .catch(() => {});
    return;
  }

  const avatarRecord = await ensClient.getTextRecord({ name: ens_name, key: 'avatar' });
  const avatar = typeof avatarRecord === 'string' ? avatarRecord : null;

  const profileData = {
    ens_name,
    address: addressRecord.value,
    profile_data: {
      ens_avatar: avatar,
    },
    last_sync_status: `Successfully updated at ${new Date().toISOString()}`,
  };

  const now = new Date();
  await prisma.cached_profiles.upsert({
    where: { ens_name },
    update: {
      profile_data: JSON.stringify(profileData),
      updated_at: now,
      last_sync_status: profileData.last_sync_status,
      last_content_update: now,
      next_sync_due: new Date(now.getTime() + PROFILE_TTL_MS),
    },
    create: {
      ens_name,
      profile_data: JSON.stringify(profileData),
      last_sync_status: profileData.last_sync_status,
      last_content_update: now,
      next_sync_due: new Date(now.getTime() + PROFILE_TTL_MS),
    },
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ens_name, refresh } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!ens_name || typeof ens_name !== 'string') {
    return res.status(400).json({ error: 'Invalid ENS name' });
  }

  try {
    const profile = await prisma.cached_profiles.findUnique({
      where: { ens_name },
    });

    const refreshRequested = refresh === 'true';
    const stale = profile ? isProfileStale(profile) : true;

    if (profile && !refreshRequested && !stale) {
      const parsedProfileData = JSON.parse(profile.profile_data ?? '{}');
      return res.status(200).json({
        ...parsedProfileData,
        last_sync_status: profile.last_sync_status ?? 'Unknown',
      });
    }

    // If stale but we have cached data, return immediately and refresh in background.
    if (profile && !refreshRequested && stale) {
      const waitUntil = (res as unknown as { waitUntil?: (promise: Promise<unknown>) => void }).waitUntil;
      const refreshPromise = refreshEnsProfile(ens_name);
      if (typeof waitUntil === 'function') waitUntil(refreshPromise);
      refreshPromise.catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[profile] Background refresh failed for ${ens_name}: ${message}`);
      });

      const parsedProfileData = JSON.parse(profile.profile_data ?? '{}');
      return res.status(200).json({
        ...parsedProfileData,
        last_sync_status: profile.last_sync_status ?? 'Unknown',
        stale: true,
      });
    }

    // No cached data or explicit refresh requested -> do the refresh synchronously.
    await refreshEnsProfile(ens_name);

    const updatedProfile = await prisma.cached_profiles.findUnique({
      where: { ens_name },
    });

    if (!updatedProfile) {
      return res.status(404).json({ error: 'ENS name not found' });
    }

    const parsedProfileData = JSON.parse(updatedProfile.profile_data ?? '{}');
    return res.status(200).json({
      ...parsedProfileData,
      last_sync_status: updatedProfile.last_sync_status ?? 'Unknown',
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    await prisma.cached_profiles.delete({
      where: { ens_name },
    }).catch(() => { });
    res.status(500).json({ error: 'Error fetching profile' });
  }
}
