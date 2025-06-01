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
    // Decentraland doesn't require an API key for basic profile data
    // Get profile information
    const profileResponse = await fetch(`https://profile.decentraland.org/profile/${address.toLowerCase()}`);
    
    let profileData = null;
    if (profileResponse.ok) {
      profileData = await profileResponse.json();
    }

    // Get avatar data
    let avatar = null;
    if (profileData && profileData.avatar) {
      avatar = {
        name: profileData.avatar.name || 'Avatar',
        image: profileData.avatar.avatar?.snapshots?.face256 || profileData.avatar.avatar?.snapshots?.body || ''
      };
    }

    // Get land parcels owned by the address
    let landParcels = 0;
    try {
      const landResponse = await fetch(`https://api.decentraland.org/v1/parcels?owner=${address.toLowerCase()}`);
      if (landResponse.ok) {
        const landData = await landResponse.json();
        landParcels = landData.data?.length || 0;
      }
    } catch (error) {
      console.error('Error fetching land data:', error);
    }

    // Get wearables owned by the address
    let wearables = 0;
    try {
      const wearablesResponse = await fetch(`https://wearable-api.decentraland.org/v2/addresses/${address.toLowerCase()}/wearables`);
      if (wearablesResponse.ok) {
        const wearablesData = await wearablesResponse.json();
        wearables = wearablesData.wearables?.length || 0;
      }
    } catch (error) {
      console.error('Error fetching wearables data:', error);
    }

    // Get last activity (this might not be available from public APIs)
    let lastActive = null;
    if (profileData && profileData.timestamp) {
      lastActive = new Date(profileData.timestamp).toISOString();
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
    console.error('Error fetching Decentraland data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Decentraland data. Please try again later.' 
    });
  }
} 