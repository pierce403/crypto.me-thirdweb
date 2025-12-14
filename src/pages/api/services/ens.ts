import { NextApiRequest, NextApiResponse } from 'next';
import { createEnsPublicClient } from '@ensdomains/ensjs';
import { http } from 'viem';
import { mainnet } from 'viem/chains';

const alchemyRpcUrl =
  process.env.ALCHEMY_RPC_URL ||
  (process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined);

const ensClient = createEnsPublicClient({
  chain: mainnet,
  // Keep this service fast/reliable; background fetcher times out at 10s.
  transport: http(alchemyRpcUrl, { timeout: 5000, retryCount: 0 }),
});

type EnsDependencies = {
  ensClient: typeof ensClient;
  fetchFn: typeof fetch;
};

const defaultDependencies: EnsDependencies = {
  ensClient,
  fetchFn: fetch,
};

// Helper function to fetch all ENS names owned by an address using the ENS subgraph
async function fetchAllEnsNames(address: string, fetchFn: typeof fetch): Promise<string[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const query = `
      query GetDomains($address: String!) {
        domains(where: {owner: $address}, first: 100, orderBy: createdAt, orderDirection: desc) {
          name
          createdAt
        }
      }
    `;

    const response = await fetchFn('https://api.thegraph.com/subgraphs/name/ensdomains/ens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { address: address.toLowerCase() }
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error('ENS subgraph error:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error('ENS subgraph query errors:', data.errors);
      return [];
    }

    return data.data?.domains?.map((domain: { name: string }) => domain.name) || [];
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const errorName = err.name === 'AbortError' ? 'TimeoutError' : err.name;
    console.error(`Error fetching ENS names from subgraph (${errorName}):`, err);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

export function createHandler(dependencies: EnsDependencies = defaultDependencies) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { address: queryAddressOrName } = req.query;

  if (!queryAddressOrName || typeof queryAddressOrName !== 'string') {
    return res.status(400).json({ error: 'Address or ENS name is required' });
  }

  let resolvedEthAddress: `0x${string}` | null = null;
  let operatingName: string | null = null; // The ENS name we'll use for fetching avatar etc.
  let avatar: string | null = null;
  let otherNames: string[] = [];

  const isEnsNameSyntax = (name: string) => name.includes('.') && !name.startsWith('0x');

  try {
    if (isEnsNameSyntax(queryAddressOrName)) {
      operatingName = queryAddressOrName;
      try {
        const addressRecord = await dependencies.ensClient.getAddressRecord({ name: operatingName });
        if (addressRecord && addressRecord.id === 60 && addressRecord.value) {
          resolvedEthAddress = addressRecord.value as `0x${string}` | null;
        } else {
          console.warn(`Could not resolve ENS name ${operatingName} to an ETH address. Record: `, addressRecord);
        }
      } catch (error) {
        console.error(`Error resolving ENS name ${operatingName} to ETH address:`, error);
      }
    } else if (queryAddressOrName.startsWith('0x')) {
      resolvedEthAddress = queryAddressOrName as `0x${string}`;
    } else {
      return res.status(400).json({ error: 'Invalid address or ENS name format' });
    }

    // Keep this API route fast: do not block on non-essential lookups.
    // For address inputs, we skip avatar fetching (it would require an extra RPC round-trip).
    const shouldFetchAvatar = Boolean(operatingName); // Only if user supplied an ENS name

    const primaryNamePromise = !operatingName && resolvedEthAddress
      ? dependencies.ensClient.getName({ address: resolvedEthAddress })
      : Promise.resolve(null);

    const allNamesPromise = resolvedEthAddress
      ? fetchAllEnsNames(resolvedEthAddress, dependencies.fetchFn)
      : Promise.resolve([]);

    const [primaryNameResult, allNamesResult] = await Promise.allSettled([primaryNamePromise, allNamesPromise]);

    if (!operatingName && primaryNameResult.status === 'fulfilled') {
      const nameRecord = primaryNameResult.value as { name?: string } | null;
      if (nameRecord?.name) operatingName = nameRecord.name;
    }

    if (allNamesResult.status === 'fulfilled') {
      const allNamesForAddress = allNamesResult.value;
      otherNames = operatingName
        ? allNamesForAddress.filter(name => name.toLowerCase() !== operatingName?.toLowerCase())
        : allNamesForAddress;
    }

    if (shouldFetchAvatar && operatingName) {
      try {
        const avatarRecord = await dependencies.ensClient.getTextRecord({
          name: operatingName,
          key: 'avatar'
        });
        if (typeof avatarRecord === 'string') {
          if (avatarRecord.startsWith('ipfs://')) {
            const cid = avatarRecord.slice('ipfs://'.length);
            avatar = `https://ipfs.io/ipfs/${cid}`;
          } else {
            avatar = avatarRecord;
          }
        }
      } catch (error) {
        console.error(`Error getting avatar for ${operatingName}:`, error);
      }
    }

    const profileUrl = operatingName 
      ? `https://app.ens.domains/name/${operatingName}` 
      : (resolvedEthAddress ? `https://app.ens.domains/address/${resolvedEthAddress}` : '');

    const responseData = {
      primaryName: operatingName || (isEnsNameSyntax(queryAddressOrName) ? queryAddressOrName : null) || (resolvedEthAddress ? "No primary ENS name set" : "ENS data not found"),
      avatar,
      otherNames,
      profileUrl,
      // Optional: expose the resolved address if needed by client
      // resolvedEthAddress: resolvedEthAddress 
    };

    console.log('ENS API result:', JSON.stringify(responseData, null, 2));
    res.status(200).json(responseData);

  } catch (error) {
    console.error('Error fetching ENS data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch ENS data. Please check your configuration.' 
    });
  }
  };
}

export default createHandler();
