import { NextApiRequest, NextApiResponse } from 'next';

// Helper function to check if a string is an ENS name
function isENSName(address: string): boolean {
  return address.toLowerCase().endsWith('.eth');
}

// Helper function to resolve ENS to address
async function resolveENSToAddress(ensName: string): Promise<string> {
  try {
    const response = await fetch(`https://api.ensideas.com/ens/resolve/${ensName}`);
    if (response.ok) {
      const data = await response.json();
      return data.address || ensName;
    }
  } catch (error) {
    console.error('ENS resolution error:', error);
  }
  return ensName;
}

// Updated interfaces for OpenSea v2 API
interface OpenSeaNFTv2 {
  identifier: string;
  collection: string;
  contract: string;
  name?: string;
  description?: string;
  image_url?: string;
  display_image_url?: string;
  metadata_url?: string;
  opensea_url?: string;
  updated_at?: string;
  is_disabled?: boolean;
  is_nsfw?: boolean;
}

interface OpenSeaResponsev2 {
  nfts: OpenSeaNFTv2[];
  next?: string;
}

interface ProcessedNFT {
  name: string;
  collection: string;
  image: string;
  value: number;
  currency: string;
  permalink: string;
  description?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { address } = req.query;

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Address is required' });
  }

  // Resolve ENS to address if needed
  let resolvedAddress = address;
  if (isENSName(address)) {
    resolvedAddress = await resolveENSToAddress(address);
    console.log(`Resolved ${address} to ${resolvedAddress}`);
  }

  console.log(`Fetching NFTs for address: ${resolvedAddress}`);

  const apiKey = process.env.OPENSEA_API_KEY;
  
  if (!apiKey) {
    return res.status(200).json({
      profileUrl: `https://opensea.io/${resolvedAddress}`,
      topNFTs: [],
      totalValue: 0,
      source: 'none',
      error: 'OPENSEA_API_KEY_REQUIRED'
    });
  }

  try {
    // Use OpenSea v2 API
    const response = await fetch(`https://api.opensea.io/api/v2/chain/ethereum/account/${resolvedAddress}/nfts?limit=20`, {
      headers: {
        'X-API-KEY': apiKey,
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(200).json({
          profileUrl: `https://opensea.io/${resolvedAddress}`,
          topNFTs: [],
          totalValue: 0,
          source: 'opensea'
        });
      }
      console.error(`OpenSea API error: ${response.status} ${response.statusText}`);
      
      if (response.status === 401 || response.status === 403) {
        return res.status(200).json({
          profileUrl: `https://opensea.io/${resolvedAddress}`,
          topNFTs: [],
          totalValue: 0,
          source: 'none',
          error: 'INVALID_API_KEY'
        });
      }
      
      throw new Error(`OpenSea API error: ${response.status}`);
    }

    const data: OpenSeaResponsev2 = await response.json();
    console.log(`OpenSea found ${data.nfts?.length || 0} NFTs`);

    const processedNFTs: ProcessedNFT[] = (data.nfts || [])
      .filter((nft: OpenSeaNFTv2) => nft && nft.name && !nft.is_disabled && !nft.is_nsfw)
      .slice(0, 5)
      .map((nft: OpenSeaNFTv2): ProcessedNFT => ({
        name: nft.name || 'Unnamed NFT',
        collection: nft.collection || 'Unknown Collection',
        image: nft.image_url || nft.display_image_url || '',
        value: 0, // OpenSea v2 doesn't include pricing in this endpoint
        currency: 'ETH',
        permalink: nft.opensea_url || `https://opensea.io/assets/ethereum/${nft.contract}/${nft.identifier}`,
        description: nft.description
      }));

    return res.status(200).json({
      profileUrl: `https://opensea.io/${resolvedAddress}`,
      topNFTs: processedNFTs,
      totalValue: 0,
      source: 'opensea'
    });
  } catch (error) {
    console.error('OpenSea API error:', error);
    return res.status(200).json({
      profileUrl: `https://opensea.io/${resolvedAddress}`,
      topNFTs: [],
      totalValue: 0,
      source: 'none',
      error: 'API_ERROR'
    });
  }
} 