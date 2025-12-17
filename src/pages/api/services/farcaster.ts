import { NextApiRequest, NextApiResponse } from 'next';
import { createEnsPublicClient } from '@ensdomains/ensjs';
import { http } from 'viem';
import { mainnet } from 'viem/chains';

const alchemyRpcUrl =
  process.env.ALCHEMY_RPC_URL ||
  (process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined);

const rpcUrl = alchemyRpcUrl ?? 'https://rpc.ankr.com/eth';

const ensClient = createEnsPublicClient({
  chain: mainnet,
  transport: http(rpcUrl, { timeout: 8000, retryCount: 1, retryDelay: 300 }),
});

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

type FarcasterDependencies = {
  ensClient: typeof ensClient;
  fetchFn: typeof fetch;
};

const defaultDependencies: FarcasterDependencies = {
  ensClient,
  fetchFn: fetch,
};

// Helper function to check if a string is an ENS name
function isEnsName(input: string): boolean {
  return input.includes('.') && !input.startsWith('0x');
}

// Helper function to check if a string is an Ethereum address
function isEthereumAddress(input: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(input);
}

export function createHandler(dependencies: FarcasterDependencies = defaultDependencies) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Avoid logging request headers/secrets in production.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[farcaster.ts:debug] Incoming request. Method: ${req.method}, URL: ${req.url}`);
      console.log(`[farcaster.ts:debug] NEYNAR_API_KEY present: ${Boolean(process.env.NEYNAR_API_KEY)}`);
    }

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { address } = req.query;

    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Address or ENS name is required' });
    }

    let resolvedAddress = address;

    // If input looks like an ENS name, resolve it to an address
    if (isEnsName(address)) {
      try {
        const addressRecord = await dependencies.ensClient.getAddressRecord({ name: address });
        if (!addressRecord?.value || addressRecord.value === '0x0000000000000000000000000000000000000000') {
          return res.status(404).json({ error: 'ENS name not found or not resolved to a valid address' });
        }
        resolvedAddress = addressRecord.value;
      } catch (error) {
        console.error('Error resolving ENS name:', error);
        return res.status(400).json({ error: 'Invalid ENS name or resolution failed' });
      }
    } else if (!isEthereumAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address or ENS name format' });
    }

    const apiKey = process.env.NEYNAR_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'Neynar API key not configured. Please set NEYNAR_API_KEY environment variable.'
      });
    }

    try {
      // First, get user by verified address (now using resolved address)
      const userResponse = await dependencies.fetchFn(`https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${resolvedAddress}`, {
        headers: {
          'accept': 'application/json',
          'x-api-key': apiKey,
        },
      });

      if (!userResponse.ok) {
        // Check for invalid API key specifically
        if (userResponse.status === 401) {
          return res.status(500).json({
            error: 'Invalid Neynar API key. Please check your NEYNAR_API_KEY environment variable.'
          });
        }
        if (userResponse.status === 403) {
          return res.status(500).json({
            error: 'Neynar API key access denied. Please verify your API key permissions.'
          });
        }
        if (userResponse.status === 404) {
          return res.status(200).json(null);
        }

        // Try to get more details about the error
        let errorMessage = `Neynar API error: ${userResponse.status}`;
        try {
          const errorData = await userResponse.json();
          if (errorData.message) {
            errorMessage += ` - ${errorData.message}`;
          }
        } catch {
          // Ignore JSON parsing errors for error responses
        }

        throw new Error(errorMessage);
      }

      const userData = await userResponse.json();

      // The new bulk-by-address endpoint returns an object with address keys (in lowercase)
      const usersByAddress = userData[resolvedAddress.toLowerCase()];
      const user = usersByAddress && usersByAddress.length > 0 ? usersByAddress[0] : null;

      if (!user) {
        return res.status(200).json(null);
      }

      // Calculate a simple Neynar score based on available metrics
      // Note: The API now includes a 'score' field directly, but let's also calculate our own for consistency
      const followerCount = user.follower_count || 0;
      const followingCount = user.following_count || 0;
      const powerBadge = user.power_badge || false;

      // Use the official Neynar score if available, otherwise calculate our own
      let neynarScore = user.score || user.experimental?.neynar_user_score || 0;

      // If no official score, calculate our simplified version
      if (!neynarScore) {
        neynarScore += Math.min(followerCount / 1000, 0.4); // Up to 0.4 for followers
        neynarScore += Math.min(followingCount / 500, 0.2);  // Up to 0.2 for following
        neynarScore += powerBadge ? 0.3 : 0;                 // 0.3 for power badge
        neynarScore += user.verified_addresses?.eth_addresses?.length > 0 ? 0.1 : 0; // 0.1 for verified addresses
        neynarScore = Math.min(neynarScore, 1.0); // Cap at 1.0
      }

      const fid = typeof user.fid === 'number' ? user.fid : undefined;
      const custodyAddress = typeof user.custody_address === 'string' ? user.custody_address : undefined;

      const verifiedAddressesRaw = isRecord(user.verified_addresses) ? user.verified_addresses : null;
      const ethAddressesRaw: unknown[] = verifiedAddressesRaw && Array.isArray(verifiedAddressesRaw.eth_addresses)
        ? (verifiedAddressesRaw.eth_addresses as unknown[])
        : [];
      const solAddressesRaw: unknown[] = verifiedAddressesRaw && Array.isArray(verifiedAddressesRaw.sol_addresses)
        ? (verifiedAddressesRaw.sol_addresses as unknown[])
        : [];
      const ensDomainsRaw = verifiedAddressesRaw && Array.isArray((verifiedAddressesRaw as UnknownRecord).ens_domains)
        ? ((verifiedAddressesRaw as UnknownRecord).ens_domains as unknown[])
        : [];

      const ethAddresses = ethAddressesRaw.filter((value): value is string => typeof value === 'string');
      const solAddresses = solAddressesRaw.filter((value): value is string => typeof value === 'string');
      const ensDomains = ensDomainsRaw.filter((value): value is string => typeof value === 'string');
      const verificationsRaw = Array.isArray((user as UnknownRecord).verifications)
        ? ((user as UnknownRecord).verifications as unknown[])
        : [];
      const verificationAddresses = verificationsRaw.filter((value): value is string => typeof value === 'string');

      const farname =
        typeof (user as UnknownRecord).fname === 'string'
          ? ((user as UnknownRecord).fname as string)
          : (typeof user.username === 'string' ? user.username : undefined);

      const basename = (() => {
        const direct = (user as UnknownRecord).basename;
        if (typeof direct === 'string') return direct;
        return ensDomains.find((name) => name.toLowerCase().endsWith('.base.eth'));
      })();

      const profileUrl = typeof user.username === 'string'
        ? `https://warpcast.com/${user.username}`
        : (fid ? `https://warpcast.com/~/profiles/${fid}` : undefined);

      const pfpUrl = typeof user.pfp_url === 'string' ? user.pfp_url : undefined;
      const bio = (() => {
        const profile = (user as UnknownRecord).profile;
        if (!isRecord(profile)) return undefined;
        const profileBio = profile.bio;
        if (!isRecord(profileBio)) return undefined;
        return typeof profileBio.text === 'string' ? profileBio.text : undefined;
      })();

      const connectedAccounts = (() => {
        const accounts: Array<{ platform: string; username: string }> = [];
        const candidates = ['verified_accounts', 'connected_accounts'] as const;

        for (const key of candidates) {
          const value = (user as UnknownRecord)[key];
          if (!isRecord(value)) continue;

          for (const [platform, accountValue] of Object.entries(value)) {
            if (typeof accountValue === 'string') {
              accounts.push({ platform, username: accountValue });
              continue;
            }

            if (!isRecord(accountValue)) continue;
            const username =
              typeof accountValue.username === 'string'
                ? accountValue.username
                : (typeof accountValue.handle === 'string' ? accountValue.handle : undefined);

            if (username) accounts.push({ platform, username });
          }
        }

        // Deduplicate by platform+username
        const seen = new Set<string>();
        return accounts.filter((account) => {
          const key = `${account.platform}:${account.username}`.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      })();

      const result = {
        fid,
        username: user.username,
        farname,
        basename,
        displayName: user.display_name || user.username,
        createdAt: user.created_at ? new Date(user.created_at).toISOString() : new Date().toISOString(),
        walletAddress: resolvedAddress,
        custodyAddress,
        connectedAddresses: ethAddresses.length > 0 ? ethAddresses : verificationAddresses,
        verifiedAddresses: {
          ethAddresses,
          solAddresses,
          ensDomains,
        },
        connectedAccounts,
        pfpUrl,
        bio,
        followerCount: followerCount,
        followingCount: followingCount,
        powerBadge: powerBadge,
        neynarScore: neynarScore,
        resolvedAddress: resolvedAddress, // Include the resolved address for debugging
        profileUrl,
      };

      res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching Farcaster data:', error);

      // Check if the error message contains API key related issues
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
      if (errorMessage.includes('unauthorized') || errorMessage.includes('401') ||
        errorMessage.includes('forbidden') || errorMessage.includes('403') ||
        errorMessage.includes('invalid api key') || errorMessage.includes('api key')) {
        return res.status(500).json({
          error: 'Invalid or expired Neynar API key. Please check your NEYNAR_API_KEY environment variable.'
        });
      }

      res.status(500).json({
        error: 'Failed to fetch Farcaster data. Please check your API key and try again.'
      });
    }
  };
}

export default createHandler();
