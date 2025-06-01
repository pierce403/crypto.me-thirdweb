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

  const apiKey = process.env.ICEBREAKER_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'Icebreaker API key not configured. Please set ICEBREAKER_API_KEY environment variable.' 
    });
  }

  try {
    // Icebreaker API endpoint - this is a placeholder as I don't have the exact API structure
    // You'll need to replace this with the actual Icebreaker API endpoint and structure
    const response = await fetch(`https://api.icebreaker.xyz/v1/profiles/${address}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(200).json({ socialIdentities: [] });
      }
      throw new Error(`Icebreaker API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform the data to match our expected format
    // This structure is a placeholder - adjust based on actual Icebreaker API response
    const socialIdentities = data.socialIdentities?.map((identity: {
      platform?: string;
      type?: string;
      username?: string;
      handle?: string;
      verified?: boolean;
    }) => ({
      platform: identity.platform || identity.type,
      username: identity.username || identity.handle,
      verified: identity.verified || false,
    })) || [];

    res.status(200).json({ socialIdentities });
  } catch (error) {
    console.error('Error fetching Icebreaker data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Icebreaker data. Please check your API key and try again.' 
    });
  }
} 