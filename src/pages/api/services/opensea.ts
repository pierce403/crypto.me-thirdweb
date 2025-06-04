import { NextApiRequest, NextApiResponse } from 'next';
import { createEnsPublicClient } from '@ensdomains/ensjs';
import { http } from 'viem';
import { mainnet } from 'viem/chains';

const ensClient = createEnsPublicClient({
  chain: mainnet,
  transport: http(),
});

// Helper function to check if a string is an ENS name
function isENSName(address: string): boolean {
  return address.toLowerCase().endsWith('.eth');
}

// Helper function to check if a string is an Ethereum address
function isEthereumAddress(input: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(input);
}

interface ValuedNFT {
  name: string;
  collection: string;
  image: string;
  floorPrice: number;
  lastSalePrice?: number;
  currency: string;
  permalink: string;
  rarity?: string;
  estimatedValue: number;
}

interface MarketStats {
  totalEstimatedValue: number;
  totalFloorValue: number;
  uniqueCollections: number;
  totalNFTs: number;
  topCollectionsByValue: Array<{
    name: string;
    count: number;
    floorPrice: number;
    totalValue: number;
  }>;
}

interface OpenSeaResult {
  profileUrl: string;
  topValuedNFTs: ValuedNFT[];
  marketStats: MarketStats;
  portfolioSummary: {
    totalValue: number;
    currency: string;
    lastUpdated: string;
  };
  source: string;
  error?: string;
}

// Simulate market data (would use real OpenSea API in production)
async function fetchMarketDataFromOpenSea(address: string): Promise<OpenSeaResult> {
  try {
    const openSeaApiKey = process.env.OPENSEA_API_KEY;
    
    if (!openSeaApiKey) {
      // Provide demo market data when no API key
      return getDemoMarketData(address);
    }

    // In a real implementation, this would call OpenSea's API
    // const response = await fetch(`https://api.opensea.io/v2/chain/ethereum/account/${address}/nfts`, {
    //   headers: {
    //     'X-API-KEY': openSeaApiKey,
    //     'Accept': 'application/json'
    //   }
    // });

    // For now, return demo data
    console.log('OpenSea API key available, but using demo data for now');
    return getDemoMarketData(address);

  } catch (error) {
    console.error('OpenSea market data error:', error);
    return getDemoMarketData(address);
  }
}

function getDemoMarketData(address: string): OpenSeaResult {
  // Generate user-specific demo data based on their address
  // This simulates personalized NFT portfolios for different users
  
  // Create a simple hash from the address to generate consistent but varied data
  const addressHash = address.toLowerCase().split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  const userId = Math.abs(addressHash) % 1000;
  
  // Define multiple sets of example NFTs that users might own
  const nftCollections = [
    {
      name: 'Pudgy Penguins #{{id}}',
      collection: 'Pudgy Penguins',
      image: 'https://img.seadn.io/files/pudgy-penguins.png',
      baseFloor: 4.5,
      permalink: 'https://opensea.io/assets/ethereum/0xbd3531da5cf5857e7cfaa92426877b022e612cf8/{{id}}'
    },
    {
      name: 'Doodles #{{id}}',
      collection: 'Doodles',
      image: 'https://img.seadn.io/files/doodles.png',
      baseFloor: 2.1,
      permalink: 'https://opensea.io/assets/ethereum/0x8a90cab2b38dba80c64b7734e58ee1db38b8992e/{{id}}'
    },
    {
      name: 'Cool Cats #{{id}}',
      collection: 'Cool Cats NFT',
      image: 'https://img.seadn.io/files/cool-cats.png',
      baseFloor: 1.8,
      permalink: 'https://opensea.io/assets/ethereum/0x1a92f7381b9f03921564a437210bb9396471050c/{{id}}'
    },
    {
      name: 'World of Women #{{id}}',
      collection: 'World of Women',
      image: 'https://img.seadn.io/files/world-of-women.png',
      baseFloor: 1.2,
      permalink: 'https://opensea.io/assets/ethereum/0xe785e82358879f061bc3dcac6f0444462d4b5330/{{id}}'
    },
    {
      name: 'Moonbirds #{{id}}',
      collection: 'Moonbirds',
      image: 'https://img.seadn.io/files/moonbirds.png',
      baseFloor: 3.7,
      permalink: 'https://opensea.io/assets/ethereum/0x23581767a106ae21c074b2276d25e5c3e136a68b/{{id}}'
    },
    {
      name: 'VeeFriends #{{id}}',
      collection: 'VeeFriends',
      image: 'https://img.seadn.io/files/veefriends.png',
      baseFloor: 0.9,
      permalink: 'https://opensea.io/assets/ethereum/0xa3aee8bce55beea1951ef834b99f3ac60d1abeeb/{{id}}'
    }
  ];
  
  // Select 3 random collections for this user based on their address hash
  const userCollections = [
    nftCollections[userId % nftCollections.length],
    nftCollections[(userId + 1) % nftCollections.length],
    nftCollections[(userId + 2) % nftCollections.length]
  ];
  
  // Generate user-specific NFTs
  const topValuedNFTs: ValuedNFT[] = userCollections.map((collection, index) => {
    const tokenId = (userId + index * 100) % 9999 + 1;
    const priceMultiplier = 0.8 + (userId % 100) / 250; // Varies between 0.8x and 1.2x
    const floorPrice = collection.baseFloor * priceMultiplier;
    const estimatedValue = floorPrice * (0.95 + (index * 0.05)); // Slight variation in estimated value
    
    return {
      name: collection.name.replace('{{id}}', tokenId.toString()),
      collection: collection.collection,
      image: collection.image,
      floorPrice: parseFloat(floorPrice.toFixed(3)),
      lastSalePrice: parseFloat((floorPrice * 1.1).toFixed(3)),
      currency: 'ETH',
      permalink: collection.permalink.replace('{{id}}', tokenId.toString()),
      rarity: index === 0 ? 'Rare' : index === 1 ? 'Uncommon' : 'Common',
      estimatedValue: parseFloat(estimatedValue.toFixed(3))
    };
  });
  
  // Calculate user-specific portfolio stats
  const totalEstimatedValue = topValuedNFTs.reduce((sum, nft) => sum + nft.estimatedValue, 0);
  const totalFloorValue = topValuedNFTs.reduce((sum, nft) => sum + nft.floorPrice, 0);
  const uniqueCollections = userCollections.length + (userId % 5) + 2; // 5-9 collections
  const totalNFTs = uniqueCollections * 3 + (userId % 12); // Varied portfolio size
  
  // Generate collection stats based on user's profile
  const topCollectionsByValue = userCollections.map((collection, index) => {
    const count = (userId % 5) + 1 + index; // 1-8 NFTs per collection
    const totalValue = collection.baseFloor * count * (1 + index * 0.1);
    
    return {
      name: collection.collection,
      count,
      floorPrice: parseFloat(collection.baseFloor.toFixed(3)),
      totalValue: parseFloat(totalValue.toFixed(3))
    };
  }).sort((a, b) => b.totalValue - a.totalValue);

  const marketStats: MarketStats = {
    totalEstimatedValue: parseFloat(totalEstimatedValue.toFixed(2)),
    totalFloorValue: parseFloat(totalFloorValue.toFixed(2)),
    uniqueCollections,
    totalNFTs,
    topCollectionsByValue
  };

  return {
    profileUrl: `https://opensea.io/${address}`,
    topValuedNFTs,
    marketStats,
    portfolioSummary: {
      totalValue: marketStats.totalEstimatedValue,
      currency: 'ETH',
      lastUpdated: new Date().toISOString()
    },
    source: process.env.OPENSEA_API_KEY ? 'opensea-demo' : 'demo'
  };
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

  let resolvedAddress = address;

  // If input looks like an ENS name, resolve it to an address
  if (isENSName(address)) {
    try {
      const addressRecord = await ensClient.getAddressRecord({ name: address });
      if (!addressRecord?.value || addressRecord.value === '0x0000000000000000000000000000000000000000') {
        return res.status(404).json({ error: 'ENS name not found or not resolved to a valid address' });
      }
      resolvedAddress = addressRecord.value;
      console.log(`Resolved ${address} to ${resolvedAddress}`);
    } catch (error) {
      console.error('Error resolving ENS name:', error);
      return res.status(400).json({ error: 'Invalid ENS name or resolution failed' });
    }
  } else if (!isEthereumAddress(address)) {
    return res.status(400).json({ error: 'Invalid Ethereum address or ENS name format' });
  }

  console.log(`Fetching OpenSea market data for: ${resolvedAddress}`);

  try {
    const result = await fetchMarketDataFromOpenSea(resolvedAddress);
    return res.status(200).json(result);
  } catch (error) {
    console.error('OpenSea service error:', error);
    
    return res.status(200).json({
      profileUrl: `https://opensea.io/${resolvedAddress}`,
      topValuedNFTs: [],
      marketStats: {
        totalEstimatedValue: 0,
        totalFloorValue: 0,
        uniqueCollections: 0,
        totalNFTs: 0,
        topCollectionsByValue: []
      },
      portfolioSummary: {
        totalValue: 0,
        currency: 'ETH',
        lastUpdated: new Date().toISOString()
      },
      source: 'none',
      error: 'SERVICE_ERROR'
    });
  }
} 