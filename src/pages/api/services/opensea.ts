import { NextApiRequest, NextApiResponse } from 'next';
import { createEnsPublicClient } from '@ensdomains/ensjs';
import { http } from 'viem';
import { mainnet } from 'viem/chains';

const alchemyRpcUrl =
  process.env.ALCHEMY_RPC_URL ||
  (process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined);

const ensClient = createEnsPublicClient({
  chain: mainnet,
  transport: http(alchemyRpcUrl, { timeout: 8000, retryCount: 1, retryDelay: 300 }),
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
      // Return empty data when no API key instead of demo data
      return {
        profileUrl: `https://opensea.io/${address}`,
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
        error: 'OPENSEA_API_KEY_REQUIRED'
      };
    }

    // In a real implementation, this would call OpenSea's API
    // const response = await fetch(`https://api.opensea.io/v2/chain/ethereum/account/${address}/nfts`, {
    //   headers: {
    //     'X-API-KEY': openSeaApiKey,
    //     'Accept': 'application/json'
    //   }
    // });

    // For now, return empty data since we don't have real API integration
    console.log('OpenSea API key available, but real API integration not implemented yet');
    return {
      profileUrl: `https://opensea.io/${address}`,
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
      error: 'API_INTEGRATION_PENDING'
    };

  } catch (error) {
    console.error('OpenSea market data error:', error);
    return {
      profileUrl: `https://opensea.io/${address}`,
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
    };
  }
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
