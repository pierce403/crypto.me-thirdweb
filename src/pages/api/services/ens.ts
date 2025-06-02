import { NextApiRequest, NextApiResponse } from 'next';
import { createEnsPublicClient } from '@ensdomains/ensjs';
import { http } from 'viem';
import { mainnet } from 'viem/chains';

const ensClient = createEnsPublicClient({
  chain: mainnet,
  transport: http(),
});

// Helper function to fetch all ENS names owned by an address using the ENS subgraph
async function fetchAllEnsNames(address: string): Promise<string[]> {
  try {
    const query = `
      query GetDomains($address: String!) {
        domains(where: {owner: $address}, first: 100, orderBy: createdAt, orderDirection: desc) {
          name
          createdAt
        }
      }
    `;

    const response = await fetch('https://api.thegraph.com/subgraphs/name/ensdomains/ens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { address: address.toLowerCase() }
      })
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
    console.error('Error fetching ENS names from subgraph:', error);
    return [];
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
        const addressRecord = await ensClient.getAddressRecord({ name: operatingName });
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
      try {
        const nameRecord = await ensClient.getName({ address: resolvedEthAddress });
        if (nameRecord?.name) {
          operatingName = nameRecord.name;
        } else {
          console.warn(`Could not resolve address ${resolvedEthAddress} to a primary ENS name.`);
        }
      } catch (error) {
        console.error(`Error getting primary name for address ${resolvedEthAddress}:`, error);
      }
    } else {
      return res.status(400).json({ error: 'Invalid address or ENS name format' });
    }

    // Get avatar for the operatingName (if we have one)
    if (operatingName) {
      try {
        const avatarRecord = await ensClient.getTextRecord({ 
          name: operatingName, 
          key: 'avatar' 
        });
        if (typeof avatarRecord === 'string') {
          if (avatarRecord.startsWith('ipfs://')) {
            const cid = avatarRecord.slice('ipfs://'.length);
            // Using a common public gateway, you might prefer a specific one or your own
            avatar = `https://ipfs.io/ipfs/${cid}`; 
          } else {
            avatar = avatarRecord; // Could be http(s) URL or other schemes
          }
        }
      } catch (error) {
        console.error(`Error getting avatar for ${operatingName}:`, error);
      }
    }

    // Fetch all ENS names owned by the resolvedEthAddress
    if (resolvedEthAddress) {
      try {
        const allNamesForAddress = await fetchAllEnsNames(resolvedEthAddress);
        otherNames = operatingName 
          ? allNamesForAddress.filter(name => name.toLowerCase() !== operatingName?.toLowerCase())
          : allNamesForAddress;
      } catch (error) {
        console.error(`Error fetching all ENS names for ${resolvedEthAddress}:`, error);
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
} 