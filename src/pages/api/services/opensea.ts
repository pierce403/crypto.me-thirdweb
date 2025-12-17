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

const defaultDependencies = {
  ensClient,
};

export function createHandler(dependencies = defaultDependencies) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { ensClient } = dependencies;

    // Simulate market data (would use real OpenSea API in production)
    async function fetchMarketDataFromOpenSea(address: string): Promise<OpenSeaResult> {
      try {
        const openSeaApiKey = process.env.OPENSEA_API_KEY;
        // const openSeaApiKey = ''; // Force missing key for UI testing


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

        const response = await fetch(`https://api.opensea.io/api/v2/chain/ethereum/account/${address}/nfts?limit=20`, {
          headers: {
            'x-api-key': openSeaApiKey,
            'accept': 'application/json'
          }
        });

        if (!response.ok) {
          console.error(`OpenSea API error: ${response.status} ${response.statusText}`);
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

        const data: unknown = await response.json();
        const nfts = isRecord(data) && Array.isArray(data.nfts) ? data.nfts : [];

        // Process NFTs
        // Create a basic map to aggregate collection stats from the fetched NFTs
        const collectionStats: Record<string, { count: number; name: string; totalValue: number }> = {};

        const valuedNFTs: ValuedNFT[] = nfts.flatMap((nftUnknown) => {
          if (!isRecord(nftUnknown)) return [];

          const collectionName = typeof nftUnknown.collection === 'string' ? nftUnknown.collection : 'Unknown Collection';

          if (!collectionStats[collectionName]) {
            collectionStats[collectionName] = { count: 0, name: collectionName, totalValue: 0 };
          }
          collectionStats[collectionName].count++;

          // Attempt to find image
          const imageUrl = typeof nftUnknown.image_url === 'string' ? nftUnknown.image_url : undefined;
          const displayImageUrl = typeof nftUnknown.display_image_url === 'string' ? nftUnknown.display_image_url : undefined;
          const metadataImage = (() => {
            const metadata = nftUnknown.metadata;
            if (!isRecord(metadata)) return undefined;
            return typeof metadata.image === 'string' ? metadata.image : undefined;
          })();
          const image = imageUrl ?? displayImageUrl ?? metadataImage ?? '';

          // Attempt to find value (this is limited in the basic endpoint)
          // We might not get floor price or estimated value easily here without extra calls.
          // For now, we'll default to 0 unless we find something.
          const estimatedValue = 0;

          const nftName = typeof nftUnknown.name === 'string' ? nftUnknown.name : undefined;
          const identifier = typeof nftUnknown.identifier === 'string' ? nftUnknown.identifier : undefined;
          const openseaUrl = typeof nftUnknown.opensea_url === 'string' ? nftUnknown.opensea_url : `https://opensea.io/${address}`;

          return [{
            name: nftName ?? (identifier ? `#${identifier}` : 'NFT'),
            collection: collectionName,
            image,
            floorPrice: 0,
            lastSalePrice: 0, // Not easily available in this endpoint output sometimes
            currency: 'ETH',
            permalink: openseaUrl,
            rarity: undefined,
            estimatedValue
          }];
        });

        // Unique collections
        const uniqueCollections = Object.keys(collectionStats).length;
        const totalNFTs = nfts.length; // This is just the page limit, but serves as "recent" count

        const topCollectionsByValue = Object.values(collectionStats)
          .sort((a, b) => b.count - a.count) // Sort by count for now as we don't have value
          .slice(0, 3)
          .map(c => ({
            name: c.name,
            count: c.count,
            floorPrice: 0,
            totalValue: 0
          }));

        return {
          profileUrl: `https://opensea.io/${address}`,
          topValuedNFTs: valuedNFTs.slice(0, 5),
          marketStats: {
            totalEstimatedValue: 0,
            totalFloorValue: 0,
            uniqueCollections,
            totalNFTs,
            topCollectionsByValue
          },
          portfolioSummary: {
            totalValue: 0,
            currency: 'ETH',
            lastUpdated: new Date().toISOString()
          },
          source: 'opensea'
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
  };
}

export default createHandler(); 
