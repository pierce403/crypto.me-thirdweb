import type { NextApiRequest, NextApiResponse } from 'next';
import { ens_normalize } from '@adraffy/ens-normalize';
import { isAddress } from 'viem';
import { withPrisma } from '../../../lib/prisma';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

interface RecentProfileRow {
  ens_name: string;
  profile_data: string;
}

export function resolvedRecentProfileNames(rows: RecentProfileRow[], limit = 10): string[] {
  if (limit <= 0) return [];

  const names = new Set<string>();

  for (const row of rows) {
    let normalizedName: string;
    try {
      normalizedName = ens_normalize(row.ens_name);
      if (!normalizedName.includes('.')) continue;
    } catch {
      continue;
    }

    try {
      const profile = JSON.parse(row.profile_data) as { address?: unknown };
      if (
        typeof profile.address !== 'string'
        || !isAddress(profile.address)
        || profile.address.toLowerCase() === ZERO_ADDRESS
      ) continue;
    } catch {
      continue;
    }

    names.add(normalizedName);
    if (names.size === limit) break;
  }

  return [...names];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const recentProfiles = await withPrisma((prisma) => prisma.cached_profiles.findMany({
        where: {
          last_sync_status: {
            contains: 'Successfully updated',
          },
          // Current profile writes always set this after a successful ENS
          // resolution. Excluding expired/null rows keeps legacy stale names
          // out without turning the homepage into a batch of live RPC calls.
          next_sync_due: {
            gt: new Date(),
          },
        },
        orderBy: {
          updated_at: 'desc',
        },
        // Read extra candidates because invalid legacy rows are filtered below.
        take: 50,
        select: {
          ens_name: true,
          profile_data: true,
        },
      }));

      const profileNames = resolvedRecentProfileNames(recentProfiles);

      res.status(200).json({ profiles: profileNames });
    } catch (error) {
      console.error('Error fetching recent profiles:', error);
      res.status(500).json({ error: 'Failed to fetch recent profiles' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
