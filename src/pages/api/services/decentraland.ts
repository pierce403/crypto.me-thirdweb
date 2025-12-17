import { NextApiRequest, NextApiResponse } from 'next';

// Correct Decentraland contract addresses
const LAND_CONTRACT = '0xF87E31492Faf9A91B02Ee0dEAAd50d51d56D5d4d'; // Official LAND NFT contract
const ESTATE_CONTRACT = '0x959e104E1a4dB6317fA58F8295F586e1A978c297'; // Estate contract

interface DecentralandNFT {
  id?: string;
  tokenId?: string;
  contractAddress?: string;
  category?: string;
  name?: string;
  data?: {
    estate?: {
      size?: number;
      parcels?: Array<{ x: number; y: number }>;
    };
  };
}

interface DecentralandNFTItem {
  nft: DecentralandNFT;
  order?: Record<string, unknown>;
  rental?: Record<string, unknown>;
}

interface DecentralandNFTResponse {
  data?: DecentralandNFTItem[];
  total?: number;
}

interface DebugInfo {
  peerAPI: {
    status: string;
    count?: number;
    statusCode?: number;
    message?: string;
  };
  nftServer: {
    status: string;
    totalNFTs?: number;
    categories?: string[];
    landCount?: number;
    estateCount?: number;
    totalEstateParcelCount?: number;
    wearableCount?: number;
    sample?: Array<{
      category?: string;
      name?: string;
      contractAddress?: string;
    }>;
    statusCode?: number;
    response?: string;
    message?: string;
  };
  theGraph: {
    status: string;
    reason?: string;
    nftCount?: number;
    landCount?: number;
    statusCode?: number;
    message?: string;
  };
  openSea: {
    status: string;
    reason?: string;
    assetsCount?: number;
    statusCode?: number;
    blocked?: boolean;
    message?: string;
  };
  alchemy: {
    status: string;
    reason?: string;
    count?: number;
    statusCode?: number;
    message?: string;
  };
}

const defaultDependencies = {
  fetchFn: fetch,
};

export function createHandler(dependencies = defaultDependencies) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { fetchFn: fetch } = dependencies;

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { address } = req.query;

    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Address is required' });
    }

    try {
      // Initialize result object
      let avatar = null;
      let landParcels = 0;
      let wearables = 0;
      let lastActive = null;
      const debugInfo: DebugInfo = {
        peerAPI: { status: 'not-started' },
        nftServer: { status: 'not-started' },
        theGraph: { status: 'not-started' },
        openSea: { status: 'not-started' },
        alchemy: { status: 'not-started' }
      };

      // Method 1: Try to get profile data from Catalyst peer API (Lambdas)
      try {
        const peerResponse = await fetch(`https://peer.decentraland.org/lambdas/profiles/${address.toLowerCase()}`);

        if (peerResponse.ok) {
          const peerData = await peerResponse.json();
          // Lambdas endpoint returns { avatars: [...] }
          debugInfo.peerAPI = { status: 'success', count: peerData?.avatars?.length || 0 };

          if (peerData && peerData.avatars && peerData.avatars.length > 0) {
            const profile = peerData.avatars[0];
            if (profile.avatar) {
              avatar = {
                name: profile.name || 'Avatar',
                image: profile.avatar.snapshots?.face256 ||
                  profile.avatar.snapshots?.body || ''
              };
            }
            // Lambdas profiles usually don't have a timestamp field at root, 
            // but we can assume if we got data, they exist.
            lastActive = new Date().toISOString(); // Or leave null if we can't find it
          }
        } else {
          debugInfo.peerAPI = { status: 'failed', statusCode: peerResponse.status };
        }
      } catch (error) {
        debugInfo.peerAPI = { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
      }

      // Method 2: Use Decentraland's official nft-server API
      try {
        const nftServerResponse = await fetch(
          `https://nft-api.decentraland.org/v1/nfts?owner=${address.toLowerCase()}&first=100`,
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (compatible; DecentralandAPI/1.0)'
            }
          }
        );

        if (nftServerResponse.ok) {
          const nftData: DecentralandNFTResponse = await nftServerResponse.json();
          const nfts = nftData.data || [];

          debugInfo.nftServer = {
            status: 'success',
            totalNFTs: nfts.length,
            categories: nfts.map(item => item.nft?.category).filter(Boolean) as string[]
          };

          // Count LAND parcels and estates (data is nested under .nft property)
          const landCount = nfts.filter((item: DecentralandNFTItem) =>
            item.nft?.category === 'parcel' ||
            item.nft?.contractAddress?.toLowerCase() === LAND_CONTRACT.toLowerCase()
          ).length;

          const estateCount = nfts.filter((item: DecentralandNFTItem) =>
            item.nft?.category === 'estate' ||
            item.nft?.contractAddress?.toLowerCase() === ESTATE_CONTRACT.toLowerCase()
          ).length;

          const wearableCount = nfts.filter((item: DecentralandNFTItem) =>
            item.nft?.category === 'wearable'
          ).length;

          // For estates, also count the total parcel count within estates
          let totalEstateParcelCount = 0;
          nfts.forEach((item: DecentralandNFTItem) => {
            if (item.nft?.category === 'estate' && item.nft?.data?.estate?.size) {
              totalEstateParcelCount += item.nft.data.estate.size;
            }
          });

          landParcels = landCount + estateCount;
          wearables = wearableCount;

          debugInfo.nftServer.landCount = landCount;
          debugInfo.nftServer.estateCount = estateCount;
          debugInfo.nftServer.totalEstateParcelCount = totalEstateParcelCount;
          debugInfo.nftServer.wearableCount = wearableCount;
          debugInfo.nftServer.sample = nfts.slice(0, 2).map(item => ({
            category: item.nft?.category,
            name: item.nft?.name,
            contractAddress: item.nft?.contractAddress
          }));

        } else {
          const responseText = await nftServerResponse.text();
          debugInfo.nftServer = {
            status: 'failed',
            statusCode: nftServerResponse.status,
            response: responseText.substring(0, 300) + '...'
          };
        }
      } catch (error) {
        debugInfo.nftServer = { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
      }

      // Method 3: Fallback to The Graph subgraph (if nft-server fails)
      if (landParcels === 0) {
        try {
          const graphResponse = await fetch('https://api.thegraph.com/subgraphs/name/decentraland/marketplace', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: `
                query GetNFTs($owner: String!) {
                  nfts(where: { owner: $owner }, first: 100) {
                    id
                    category
                    tokenId
                    contractAddress
                    parcel {
                      x
                      y
                    }
                  }
                }
              `,
              variables: {
                owner: address.toLowerCase()
              }
            })
          });

          if (graphResponse.ok) {
            const graphData = await graphResponse.json();
            if (graphData.data && graphData.data.nfts) {
              const graphNfts = graphData.data.nfts;
              const graphLandCount = graphNfts.filter((nft: { category: string }) =>
                nft.category === 'parcel' || nft.category === 'estate'
              ).length;

              debugInfo.theGraph = {
                status: 'success',
                nftCount: graphNfts.length,
                landCount: graphLandCount
              };

              if (graphLandCount > landParcels) {
                landParcels = graphLandCount;
              }
            } else {
              debugInfo.theGraph = { status: 'success', nftCount: 0 };
            }
          } else {
            debugInfo.theGraph = { status: 'failed', statusCode: graphResponse.status };
          }
        } catch (error) {
          debugInfo.theGraph = { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
        }
      } else {
        debugInfo.theGraph = { status: 'skipped', reason: 'Already found land via nft-server' };
      }

      // Method 4: Try OpenSea as final fallback (for comparison)
      if (landParcels === 0) {
        try {
          const openSeaResponse = await fetch(
            `https://api.opensea.io/api/v1/assets?owner=${address}&asset_contract_address=${LAND_CONTRACT}&limit=20`,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
              }
            }
          );

          if (openSeaResponse.ok) {
            const openSeaData = await openSeaResponse.json();
            debugInfo.openSea = { status: 'success', assetsCount: openSeaData.assets?.length || 0 };
            if (openSeaData.assets) {
              landParcels += openSeaData.assets.length;
            }
          } else {
            const responseText = await openSeaResponse.text();
            const isBlocked = responseText.includes('Cloudflare') || responseText.includes('blocked');
            debugInfo.openSea = {
              status: 'failed',
              statusCode: openSeaResponse.status,
              blocked: isBlocked
            };
          }
        } catch (error) {
          debugInfo.openSea = { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
        }
      } else {
        debugInfo.openSea = { status: 'skipped', reason: 'Already found land via other APIs' };
      }

      // Method 5: Try alternative APIs if available
      if (process.env.ALCHEMY_API_KEY && landParcels === 0) {
        try {
          const alchemyResponse = await fetch(
            `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}/getNFTs/?owner=${address}&contractAddresses[]=${LAND_CONTRACT}&contractAddresses[]=${ESTATE_CONTRACT}`
          );

          if (alchemyResponse.ok) {
            const alchemyData = await alchemyResponse.json();
            const alchemyLandCount = alchemyData.ownedNfts?.length || 0;
            debugInfo.alchemy = { status: 'success', count: alchemyLandCount };
            if (alchemyLandCount > landParcels) {
              landParcels = alchemyLandCount;
            }
          } else {
            debugInfo.alchemy = { status: 'failed', statusCode: alchemyResponse.status };
          }
        } catch (error) {
          debugInfo.alchemy = { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
        }
      } else {
        debugInfo.alchemy = { status: 'skipped', reason: process.env.ALCHEMY_API_KEY ? 'Already found land' : 'No API key' };
      }

      const result = {
        profileUrl: `https://builder.decentraland.org/profile/${address.toLowerCase()}`,
        avatar,
        landParcels,
        wearables,
        lastActive,
        debug: debugInfo, // Include debug info to help troubleshoot
      };

      res.status(200).json(result);
    } catch (error) {
      console.error('Error in Decentraland API handler:', error);
      res.status(500).json({
        error: 'Failed to fetch Decentraland data. Please try again later.',
        debug: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  };
}

export default createHandler(); 