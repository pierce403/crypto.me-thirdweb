import { NextApiRequest, NextApiResponse } from 'next';

// Correct Decentraland contract addresses
const LAND_CONTRACT = '0xF87E31492Faf9A91B02Ee0dEAAd50d51d56D5d4d'; // Official LAND NFT contract
const ESTATE_CONTRACT = '0x959e104E1a4dB6317fA58F8295F586e1A978c297'; // Estate contract
const WEARABLES_CONTRACT = '0xb7F7F6C52F2e2fdb1963Eab30438024864c313F6'; // Collection store contract

interface DecentralandNFT {
  category?: string;
  id?: string;
}

interface DecentralandNFTResponse {
  nfts?: DecentralandNFT[];
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

  try {
    // Initialize result object
    let avatar = null;
    let landParcels = 0;
    let wearables = 0;
    let lastActive = null;
    let debugInfo: any = {};

    // Method 1: Try to get profile data from Catalyst peer API
    try {
      const peerResponse = await fetch(`https://peer.decentraland.org/content/entities/profiles?pointers=${address.toLowerCase()}`);
      
      if (peerResponse.ok) {
        const peerData = await peerResponse.json();
        debugInfo.peerAPI = { status: 'success', count: peerData?.length || 0 };
        if (peerData && peerData.length > 0) {
          const profile = peerData[0];
          if (profile.metadata && profile.metadata.avatars) {
            const avatarData = profile.metadata.avatars[0];
            if (avatarData && avatarData.avatar) {
              avatar = {
                name: avatarData.name || 'Avatar',
                image: avatarData.avatar.snapshots?.face256 || 
                       avatarData.avatar.snapshots?.body || ''
              };
            }
          }
          lastActive = profile.timestamp ? new Date(profile.timestamp).toISOString() : null;
        }
      } else {
        debugInfo.peerAPI = { status: 'failed', statusCode: peerResponse.status };
      }
    } catch (error) {
      debugInfo.peerAPI = { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
    }

    // Method 2: Try OpenSea API with proper headers to avoid blocking
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
        debugInfo.openSeaLand = { status: 'success', assetsCount: openSeaData.assets?.length || 0 };
        if (openSeaData.assets) {
          landParcels += openSeaData.assets.length;
        }
      } else {
        const responseText = await openSeaResponse.text();
        const isBlocked = responseText.includes('Cloudflare') || responseText.includes('blocked');
        debugInfo.openSeaLand = { 
          status: 'failed', 
          statusCode: openSeaResponse.status,
          blocked: isBlocked,
          response: responseText.substring(0, 200) + '...'
        };
      }
    } catch (error) {
      debugInfo.openSeaLand = { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
    }

    // Method 3: Check Estates contract
    try {
      const openSeaEstateResponse = await fetch(
        `https://api.opensea.io/api/v1/assets?owner=${address}&asset_contract_address=${ESTATE_CONTRACT}&limit=20`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          }
        }
      );
      
      if (openSeaEstateResponse.ok) {
        const openSeaEstateData = await openSeaEstateResponse.json();
        debugInfo.openSeaEstates = { status: 'success', assetsCount: openSeaEstateData.assets?.length || 0 };
        if (openSeaEstateData.assets) {
          landParcels += openSeaEstateData.assets.length;
        }
      } else {
        const responseText = await openSeaEstateResponse.text();
        const isBlocked = responseText.includes('Cloudflare') || responseText.includes('blocked');
        debugInfo.openSeaEstates = { 
          status: 'failed', 
          statusCode: openSeaEstateResponse.status,
          blocked: isBlocked
        };
      }
    } catch (error) {
      debugInfo.openSeaEstates = { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
    }

    // Method 4: Try alternative APIs if available
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
      debugInfo.alchemy = { status: 'skipped', reason: 'No API key or already found land' };
    }

    // Method 5: Alternative approach using direct contract calls (if Infura available)
    if (process.env.INFURA_API_KEY && landParcels === 0) {
      try {
        // Get balance of LAND tokens for the address
        const infuraResponse = await fetch(
          `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_call',
              params: [
                {
                  to: LAND_CONTRACT,
                  data: `0x70a08231000000000000000000000000${address.slice(2).toLowerCase()}`
                },
                'latest'
              ],
              id: 1
            })
          }
        );
        
        if (infuraResponse.ok) {
          const infuraData = await infuraResponse.json();
          if (infuraData.result && infuraData.result !== '0x0') {
            const balance = parseInt(infuraData.result, 16);
            debugInfo.infura = { status: 'success', balance };
            if (balance > landParcels) {
              landParcels = balance;
            }
          } else {
            debugInfo.infura = { status: 'success', balance: 0 };
          }
        } else {
          debugInfo.infura = { status: 'failed', statusCode: infuraResponse.status };
        }
      } catch (error) {
        debugInfo.infura = { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
      }
    } else {
      debugInfo.infura = { status: 'skipped', reason: process.env.INFURA_API_KEY ? 'Already found land' : 'No API key' };
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
} 