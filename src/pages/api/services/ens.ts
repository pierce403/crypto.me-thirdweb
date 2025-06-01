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

  const { address, ensName } = req.query;

  if (!address && !ensName) {
    return res.status(400).json({ error: 'Address or ENS name is required' });
  }

  try {
    let primaryName = '';
    let avatar = null;
    let otherNames: string[] = [];

    // Get primary name if we have an address
    if (address && typeof address === 'string') {
      try {
        const nameRecord = await ensClient.getName({ address: address as `0x${string}` });
        if (nameRecord?.name) {
          primaryName = nameRecord.name;
        }
      } catch (error) {
        console.error('Error getting primary name:', error);
      }

      // Fetch all ENS names owned by this address
      try {
        const allNames = await fetchAllEnsNames(address);
        console.log(`Found ${allNames.length} ENS names for address ${address}:`, allNames);
        
        // Filter out the primary name from other names
        otherNames = allNames.filter(name => name !== primaryName);
      } catch (error) {
        console.error('Error fetching all ENS names:', error);
      }
    }

    // Use provided ENS name if no primary name found
    if (!primaryName && ensName && typeof ensName === 'string') {
      primaryName = ensName;
    }

    // Get avatar for the primary name
    if (primaryName) {
      try {
        const avatarRecord = await ensClient.getTextRecord({ 
          name: primaryName, 
          key: 'avatar' 
        });
        if (typeof avatarRecord === 'string' && avatarRecord.startsWith('ipfs://')) {
          const cid = avatarRecord.slice('ipfs://'.length);
          avatar = `https://gateway.pinata.cloud/ipfs/${cid}`;
        } else if (typeof avatarRecord === 'string') {
          avatar = avatarRecord;
        }
      } catch (error) {
        console.error('Error getting avatar:', error);
      }
    }

    const profileUrl = primaryName ? `https://app.ens.domains/name/${primaryName}` : '';

    const result = {
      primaryName: primaryName || 'No ENS name found',
      avatar,
      otherNames,
      profileUrl
    };

    console.log('ENS API result:', JSON.stringify(result, null, 2));
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching ENS data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch ENS data. Please check your configuration.' 
    });
  }
} 