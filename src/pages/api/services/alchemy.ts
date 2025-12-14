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

interface AlchemyNFT {
  id: {
    tokenId: string;
    tokenMetadata?: {
      tokenType: string;
    };
  };
  contract: {
    address: string;
    name?: string;
    symbol?: string;
    totalSupply?: string;
    tokenType: string;
  };
  title: string;
  description?: string;
  tokenUri?: {
    gateway: string;
    raw: string;
  };
  media?: Array<{
    gateway: string;
    thumbnail?: string;
    raw: string;
    format: string;
    bytes?: number;
  }>;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{
      trait_type: string;
      value: string;
    }>;
  };
  timeLastUpdated: string;
  contractMetadata?: {
    name?: string;
    symbol?: string;
    totalSupply?: string;
    tokenType: string;
  };
}

interface AlchemyResponse {
  ownedNfts: AlchemyNFT[];
  totalCount: number;
  pageKey?: string;
}

interface ProcessedNFT {
  name: string;
  collection: string;
  image: string;
  tokenId: string;
  contractAddress: string;
  description?: string;
  attributes?: Array<{
    trait_type: string;
    value: string;
  }>;
  lastUpdated: string;
}

interface AlchemyResult {
  totalCount: number;
  nfts: ProcessedNFT[];
  collections: {
    [key: string]: {
      name: string;
      count: number;
      symbol?: string;
    };
  };
  source: string;
  error?: string;
}

async function fetchNFTsFromAlchemy(address: string): Promise<AlchemyResult> {
  try {
    const alchemyApiKey = process.env.ALCHEMY_API_KEY;
    
    if (!alchemyApiKey) {
      return {
        totalCount: 0,
        nfts: [],
        collections: {},
        source: 'none',
        error: 'NO_API_KEY'
      };
    }

    const response = await fetch(
      `https://eth-mainnet.g.alchemy.com/nft/v3/${alchemyApiKey}/getNFTsForOwner?owner=${address}&limit=20&exclude_filters[]=SPAM`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.log(`Alchemy API returned ${response.status}: ${response.statusText}`);
      return {
        totalCount: 0,
        nfts: [],
        collections: {},
        source: 'none',
        error: 'API_ERROR'
      };
    }

    const data: AlchemyResponse = await response.json();
    console.log(`Alchemy found ${data.totalCount} NFTs for ${address}`);

    // Process NFTs
    const nfts: ProcessedNFT[] = data.ownedNfts.slice(0, 6).map((nft: AlchemyNFT) => {
      const name = nft.metadata?.name || nft.title || 'Unnamed NFT';
      const collection = nft.contractMetadata?.name || nft.contract.name || 'Unknown Collection';
      const image = nft.metadata?.image || nft.media?.[0]?.gateway || nft.media?.[0]?.thumbnail || '';
      
      return {
        name,
        collection,
        image,
        tokenId: nft.id.tokenId,
        contractAddress: nft.contract.address,
        description: nft.metadata?.description || nft.description,
        attributes: nft.metadata?.attributes,
        lastUpdated: nft.timeLastUpdated
      };
    });

    // Group by collections
    const collections: { [key: string]: { name: string; count: number; symbol?: string } } = {};
    data.ownedNfts.forEach((nft) => {
      const collectionName = nft.contractMetadata?.name || nft.contract.name || 'Unknown Collection';
      const address = nft.contract.address;
      
      if (!collections[address]) {
        collections[address] = {
          name: collectionName,
          count: 0,
          symbol: nft.contractMetadata?.symbol || nft.contract.symbol
        };
      }
      collections[address].count++;
    });

    return {
      totalCount: data.totalCount,
      nfts,
      collections,
      source: 'alchemy'
    };

  } catch (error) {
    console.error('Alchemy API error:', error);
    return {
      totalCount: 0,
      nfts: [],
      collections: {},
      source: 'none',
      error: 'FETCH_ERROR'
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

  console.log(`Fetching NFT data from Alchemy for: ${resolvedAddress}`);

  try {
    const result = await fetchNFTsFromAlchemy(resolvedAddress);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Alchemy service error:', error);
    
    return res.status(200).json({
      totalCount: 0,
      nfts: [],
      collections: {},
      source: 'none',
      error: 'SERVICE_ERROR'
    });
  }
} 
