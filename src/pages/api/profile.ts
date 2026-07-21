import { getCloudflareContext } from '@opennextjs/cloudflare';
import { ens_normalize } from '@adraffy/ens-normalize';
import type { PrismaClient } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';
import { isAddress } from 'viem';
import { getPrisma, withPrisma } from '../../../lib/prisma';
import { appEnsClient, safeEnsError } from '../../lib/ensClient';

const PROFILE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

type EnsClient = Pick<typeof appEnsClient, 'getAddressRecord' | 'getTextRecord'>;

interface ProfilePayload {
  ens_name: string;
  address: string;
  profile_data: {
    ens_avatar: string | null;
  };
  last_sync_status: string;
}

interface CachedAvatarFallback {
  address: string;
  avatar: string | null;
}

type ProfileDependencies = {
  ensClient: EnsClient;
  getPrisma: typeof getPrisma;
  withPrisma: typeof withPrisma;
};

const defaultDependencies: ProfileDependencies = {
  ensClient: appEnsClient,
  getPrisma,
  withPrisma,
};

function isProfileStale(profile: { next_sync_due: Date | null; updated_at: Date }): boolean {
  if (profile.next_sync_due && profile.next_sync_due.getTime() <= Date.now()) return true;
  return Date.now() - profile.updated_at.getTime() > PROFILE_TTL_MS;
}

export async function resolveEnsProfile(
  ensName: string,
  ensClient: EnsClient = appEnsClient,
  cachedAvatar?: CachedAvatarFallback,
): Promise<ProfilePayload | null> {
  const addressRecord = await ensClient.getAddressRecord({ name: ensName });
  if (
    !addressRecord?.value
    || !isAddress(addressRecord.value)
    || addressRecord.value.toLowerCase() === ZERO_ADDRESS
  ) {
    return null;
  }

  const canReuseCachedAvatar = cachedAvatar
    && cachedAvatar.address.toLowerCase() === addressRecord.value.toLowerCase();
  let avatar: string | null = canReuseCachedAvatar ? cachedAvatar.avatar : null;
  try {
    const avatarRecord = await ensClient.getTextRecord({ name: ensName, key: 'avatar' });
    avatar = typeof avatarRecord === 'string' ? avatarRecord : null;
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'ens_avatar_lookup_failed',
      ensName,
      error: safeEnsError(error),
    }));
  }

  return {
    ens_name: ensName,
    address: addressRecord.value,
    profile_data: {
      ens_avatar: avatar,
    },
    last_sync_status: `Successfully updated at ${new Date().toISOString()}`,
  };
}

async function removeEnsProfile(prisma: PrismaClient, ensName: string): Promise<void> {
  await prisma.cached_profiles.deleteMany({ where: { ens_name: ensName } });
}

async function persistEnsProfile(prisma: PrismaClient, profileData: ProfilePayload): Promise<void> {
  const now = new Date();
  await prisma.cached_profiles.upsert({
    where: { ens_name: profileData.ens_name },
    update: {
      profile_data: JSON.stringify(profileData),
      updated_at: now,
      last_sync_status: profileData.last_sync_status,
      last_content_update: now,
      next_sync_due: new Date(now.getTime() + PROFILE_TTL_MS),
    },
    create: {
      ens_name: profileData.ens_name,
      profile_data: JSON.stringify(profileData),
      last_sync_status: profileData.last_sync_status,
      last_content_update: now,
      next_sync_due: new Date(now.getTime() + PROFILE_TTL_MS),
    },
  });
}

async function disconnectPrisma(prisma: PrismaClient | undefined, ensName: string): Promise<void> {
  if (!prisma) return;
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'ens_profile_database_disconnect_failed',
      ensName,
      error: safeEnsError(error),
    }));
  }
}

function parseCachedProfile(profileData: string, ensName: string): ProfilePayload | null {
  try {
    const parsed = JSON.parse(profileData) as Partial<ProfilePayload>;
    if (
      typeof parsed.address !== 'string'
      || !isAddress(parsed.address)
      || parsed.address.toLowerCase() === ZERO_ADDRESS
    ) return null;

    return {
      ens_name: ensName,
      address: parsed.address,
      profile_data: {
        ens_avatar: typeof parsed.profile_data?.ens_avatar === 'string'
          ? parsed.profile_data.ens_avatar
          : null,
      },
      last_sync_status: typeof parsed.last_sync_status === 'string'
        ? parsed.last_sync_status
        : 'Unknown',
    };
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'ens_profile_cache_parse_failed',
      ensName,
      error: safeEnsError(error),
    }));
    return null;
  }
}

export function createHandler(dependencies: ProfileDependencies = defaultDependencies) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { ens_name, refresh } = req.query;

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!ens_name || typeof ens_name !== 'string') {
      return res.status(400).json({ error: 'Invalid ENS name' });
    }

    let normalizedEnsName: string;
    try {
      normalizedEnsName = ens_normalize(ens_name);
      if (!normalizedEnsName.includes('.')) throw new Error('ENS name must contain a dot');
    } catch {
      return res.status(400).json({ error: 'Invalid ENS name' });
    }

    let prisma: ReturnType<typeof getPrisma> | undefined;
    let profile: Awaited<ReturnType<PrismaClient['cached_profiles']['findUnique']>> | null = null;

    try {
      prisma = dependencies.getPrisma();
      profile = await prisma.cached_profiles.findUnique({
        where: { ens_name: normalizedEnsName },
      });
    } catch (error) {
      console.warn(JSON.stringify({
        event: 'ens_profile_cache_unavailable',
        ensName: normalizedEnsName,
        error: safeEnsError(error),
      }));
      await disconnectPrisma(prisma, normalizedEnsName);
      prisma = undefined;
    }

    const refreshRequested = refresh === 'true';
    const stale = profile ? isProfileStale(profile) : true;
    const cachedProfile = profile?.profile_data
      ? parseCachedProfile(profile.profile_data, normalizedEnsName)
      : null;

    if (profile && cachedProfile && !refreshRequested && !stale) {
      await disconnectPrisma(prisma, normalizedEnsName);
      prisma = undefined;
      return res.status(200).json({
        ...cachedProfile,
        last_sync_status: profile.last_sync_status ?? 'Unknown',
      });
    }

    // If stale but we have cached data, return immediately and refresh in background.
    if (profile && cachedProfile && !refreshRequested && stale) {
      await disconnectPrisma(prisma, normalizedEnsName);
      prisma = undefined;

      const refreshPromise = dependencies.withPrisma(async (refreshPrisma) => {
        const refreshed = await resolveEnsProfile(
          normalizedEnsName,
          dependencies.ensClient,
          {
            address: cachedProfile.address,
            avatar: cachedProfile.profile_data.ens_avatar,
          },
        );
        if (refreshed) {
          await persistEnsProfile(refreshPrisma, refreshed);
        } else {
          await removeEnsProfile(refreshPrisma, normalizedEnsName);
        }
      });
      try {
        getCloudflareContext().ctx.waitUntil(refreshPromise);
      } catch {
        void refreshPromise.catch((error) => {
          console.error(JSON.stringify({
            event: 'ens_profile_refresh_failed',
            ensName: normalizedEnsName,
            error: safeEnsError(error),
          }));
        });
      }

      return res.status(200).json({
        ...cachedProfile,
        last_sync_status: profile.last_sync_status ?? 'Unknown',
        stale: true,
      });
    }

    try {
      // A cache miss, malformed cache entry, or explicit refresh resolves synchronously.
      // Database availability is not required to return a valid ENS profile.
      const resolvedProfile = await resolveEnsProfile(
        normalizedEnsName,
        dependencies.ensClient,
        cachedProfile
          ? {
              address: cachedProfile.address,
              avatar: cachedProfile.profile_data.ens_avatar,
            }
          : undefined,
      );
      if (!resolvedProfile) {
        if (prisma) {
          try {
            await removeEnsProfile(prisma, normalizedEnsName);
          } catch (error) {
            console.warn(JSON.stringify({
              event: 'ens_profile_cache_delete_failed',
              ensName: normalizedEnsName,
              error: safeEnsError(error),
            }));
          }
        }
        return res.status(404).json({ error: 'ENS name not found' });
      }

      if (prisma) {
        try {
          await persistEnsProfile(prisma, resolvedProfile);
        } catch (error) {
          console.warn(JSON.stringify({
            event: 'ens_profile_cache_write_failed',
            ensName: normalizedEnsName,
            error: safeEnsError(error),
          }));
        }
      }

      return res.status(200).json(resolvedProfile);
    } catch (error) {
      if (cachedProfile) {
        console.warn(JSON.stringify({
          event: 'ens_profile_refresh_using_stale_cache',
          ensName: normalizedEnsName,
          error: safeEnsError(error),
        }));
        return res.status(200).json({
          ...cachedProfile,
          last_sync_status: profile?.last_sync_status ?? cachedProfile.last_sync_status,
          stale: true,
        });
      }

      console.error(JSON.stringify({
        event: 'ens_profile_request_failed',
        ensName: normalizedEnsName,
        error: safeEnsError(error),
      }));
      return res.status(503).json({ error: 'ENS resolution temporarily unavailable' });
    } finally {
      await disconnectPrisma(prisma, normalizedEnsName);
    }
  };
}

export default createHandler();
