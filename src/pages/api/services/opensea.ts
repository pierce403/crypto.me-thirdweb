import { NextApiRequest, NextApiResponse } from 'next';

interface OpenSeaNFT {
  name?: string;
  collection?: {
    name?: string;
    floor_price?: {
      value?: number;
    };
  };
  image_url?: string;
  display_image_url?: string;
  contract?: string;
  identifier?: string;
  last_sale?: {
    total_price?: number;
  };
}

interface OpenSeaResponse {
  nfts?: OpenSeaNFT[];
}

interface ProcessedNFT {
  name: string;
  collection: string;
  image: string;
  value: number;
  currency: string;
  permalink: string;
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

  const apiKey = process.env.OPENSEA_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'OpenSea API key not configured. Please set OPENSEA_API_KEY environment variable.' 
    });
  }

  try {
    // Get NFTs owned by the address
    const response = await fetch(`https://api.opensea.io/api/v2/chain/ethereum/account/${address}/nfts?limit=50`, {
      headers: {
        'X-API-KEY': apiKey,
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(200).json({ 
          profileUrl: `https://opensea.io/${address}`,
          topNFTs: [],
          totalValue: 0
        });
      }
      throw new Error(`OpenSea API error: ${response.status}`);
    }

    const data: OpenSeaResponse = await response.json();
    const nfts = data.nfts || [];

    // Process and sort NFTs by estimated value
    const processedNFTs: ProcessedNFT[] = nfts
      .filter((nft: OpenSeaNFT) => nft && nft.name && nft.collection)
      .map((nft: OpenSeaNFT): ProcessedNFT => {
        // Get collection floor price or last sale price as value estimation
        const floorPrice = nft.collection?.floor_price?.value || 0;
        const lastSalePrice = nft.last_sale?.total_price || 0;
        const estimatedValue = Math.max(floorPrice, lastSalePrice) / 1e18; // Convert from wei to ETH

        return {
          name: nft.name || 'Unnamed NFT',
          collection: nft.collection?.name || 'Unknown Collection',
          image: nft.image_url || nft.display_image_url || '',
          value: estimatedValue,
          currency: 'ETH',
          permalink: `https://opensea.io/assets/ethereum/${nft.contract}/${nft.identifier}`,
        };
      })
      .filter((nft: ProcessedNFT) => nft.value > 0) // Only include NFTs with estimated value
      .sort((a: ProcessedNFT, b: ProcessedNFT) => b.value - a.value) // Sort by value descending
      .slice(0, 5); // Take top 5

    const totalValue = processedNFTs.reduce((sum: number, nft: ProcessedNFT) => sum + nft.value, 0);

    const result = {
      profileUrl: `https://opensea.io/${address}`,
      topNFTs: processedNFTs,
      totalValue,
    };

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching OpenSea data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch OpenSea data. Please check your API key and try again.' 
    });
  }
} 