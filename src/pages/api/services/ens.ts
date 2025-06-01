import { NextApiRequest, NextApiResponse } from 'next';
import { createEnsPublicClient } from '@ensdomains/ensjs';
import { http } from 'viem';
import { mainnet } from 'viem/chains';

const ensClient = createEnsPublicClient({
  chain: mainnet,
  transport: http(),
});

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
    const otherNames: string[] = [];

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

      // For now, we can't easily get all names owned by an address without more complex queries
      // This would require additional ENS subgraph queries or other APIs
      // For demonstration, we'll leave otherNames empty for now
    }

    const profileUrl = primaryName ? `https://app.ens.domains/name/${primaryName}` : '';

    const result = {
      primaryName: primaryName || 'No ENS name found',
      avatar,
      otherNames,
      profileUrl
    };

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching ENS data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch ENS data. Please check your configuration.' 
    });
  }
} 