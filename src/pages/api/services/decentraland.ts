import { NextApiRequest, NextApiResponse } from 'next';

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

    // Try to get profile information from Decentraland's profile service
    try {
      const profileResponse = await fetch(`https://profile.decentraland.org/profile/${address.toLowerCase()}`);
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        
        // Get avatar data
        if (profileData && profileData.avatar) {
          avatar = {
            name: profileData.avatar.name || 'Avatar',
            image: profileData.avatar.avatar?.snapshots?.face256 || 
                   profileData.avatar.avatar?.snapshots?.body ||
                   profileData.avatar.snapshots?.face256 ||
                   profileData.avatar.snapshots?.body || ''
          };
        }
        
        // Check for timestamp
        if (profileData && profileData.timestamp) {
          lastActive = new Date(profileData.timestamp).toISOString();
        }
      }
    } catch {
      // Profile fetch failed, continue with other data
    }

    // Try to get land parcels using The Graph
    try {
      const landQuery = `
        query getLandByOwner($owner: String!) {
          nfts(where: { owner: $owner, category: parcel }) {
            id
            tokenId
            parcel {
              x
              y
            }
          }
        }
      `;
      
      const graphResponse = await fetch('https://api.thegraph.com/subgraphs/name/decentraland/marketplace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: landQuery,
          variables: { owner: address.toLowerCase() }
        }),
      });

      if (graphResponse.ok) {
        const graphData = await graphResponse.json();
        landParcels = graphData.data?.nfts?.length || 0;
      }
    } catch {
      // Land query failed, try fallback
      try {
        const landResponse = await fetch(`https://api.decentraland.org/v2/tiles?owner=${address.toLowerCase()}`);
        if (landResponse.ok) {
          const landData = await landResponse.json();
          landParcels = landData.data?.length || 0;
        }
      } catch {
        // Both failed, keep landParcels as 0
      }
    }

    // Try to get wearables using The Graph
    try {
      const wearablesQuery = `
        query getWearablesByOwner($owner: String!) {
          nfts(where: { owner: $owner, category: wearable }) {
            id
          }
        }
      `;
      
      const wearablesGraphResponse = await fetch('https://api.thegraph.com/subgraphs/name/decentraland/marketplace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: wearablesQuery,
          variables: { owner: address.toLowerCase() }
        }),
      });

      if (wearablesGraphResponse.ok) {
        const wearablesGraphData = await wearablesGraphResponse.json();
        wearables = wearablesGraphData.data?.nfts?.length || 0;
      }
    } catch {
      // Wearables query failed, keep as 0
    }

    const result = {
      profileUrl: `https://builder.decentraland.org/profile/${address.toLowerCase()}`,
      avatar,
      landParcels,
      wearables,
      lastActive,
    };

    res.status(200).json(result);
  } catch (error) {
    console.error('Error in Decentraland API handler:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Decentraland data. Please try again later.' 
    });
  }
} 