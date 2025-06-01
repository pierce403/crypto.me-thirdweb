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

  const apiKey = process.env.NEYNAR_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'Neynar API key not configured. Please set NEYNAR_API_KEY environment variable.' 
    });
  }

  try {
    // First, get user by verified address
    const userResponse = await fetch(`https://api.neynar.com/v2/farcaster/user/by_verified_address?address=${address}`, {
      headers: {
        'accept': 'application/json',
        'api_key': apiKey,
      },
    });

    if (!userResponse.ok) {
      // Check for invalid API key specifically
      if (userResponse.status === 401) {
        return res.status(500).json({ 
          error: 'Invalid Neynar API key. Please check your NEYNAR_API_KEY environment variable.' 
        });
      }
      if (userResponse.status === 403) {
        return res.status(500).json({ 
          error: 'Neynar API key access denied. Please verify your API key permissions.' 
        });
      }
      if (userResponse.status === 404) {
        return res.status(200).json(null);
      }
      
      // Try to get more details about the error
      let errorMessage = `Neynar API error: ${userResponse.status}`;
      try {
        const errorData = await userResponse.json();
        if (errorData.message) {
          errorMessage += ` - ${errorData.message}`;
        }
      } catch {
        // Ignore JSON parsing errors for error responses
      }
      
      throw new Error(errorMessage);
    }

    const userData = await userResponse.json();
    const user = userData.user;

    if (!user) {
      return res.status(200).json(null);
    }

    // Get additional profile data and compute Neynar score
    const profileResponse = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${user.fid}`, {
      headers: {
        'accept': 'application/json',
        'api_key': apiKey,
      },
    });

    let detailedUser = user;
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      if (profileData.users && profileData.users.length > 0) {
        detailedUser = profileData.users[0];
      }
    } else {
      // Check for API key issues in the second call too
      if (profileResponse.status === 401 || profileResponse.status === 403) {
        return res.status(500).json({ 
          error: 'Invalid Neynar API key detected during profile fetch. Please check your NEYNAR_API_KEY environment variable.' 
        });
      }
    }

    // Calculate a simple Neynar score based on available metrics
    // This is a simplified version - actual Neynar scoring may be more complex
    const followerCount = detailedUser.follower_count || 0;
    const followingCount = detailedUser.following_count || 0;
    const powerBadge = detailedUser.power_badge || false;
    
    // Simple scoring algorithm (you can adjust this)
    let neynarScore = 0;
    neynarScore += Math.min(followerCount / 1000, 0.4); // Up to 0.4 for followers
    neynarScore += Math.min(followingCount / 500, 0.2);  // Up to 0.2 for following
    neynarScore += powerBadge ? 0.3 : 0;                 // 0.3 for power badge
    neynarScore += detailedUser.verified_addresses?.eth_addresses?.length > 0 ? 0.1 : 0; // 0.1 for verified addresses

    const result = {
      username: detailedUser.username,
      displayName: detailedUser.display_name || detailedUser.username,
      createdAt: detailedUser.created_at ? new Date(detailedUser.created_at).toISOString() : new Date().toISOString(),
      connectedAddresses: detailedUser.verified_addresses?.eth_addresses || [],
      followerCount: followerCount,
      neynarScore: Math.min(neynarScore, 1.0), // Cap at 1.0
    };

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching Farcaster data:', error);
    
    // Check if the error message contains API key related issues
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
    if (errorMessage.includes('unauthorized') || errorMessage.includes('401') || 
        errorMessage.includes('forbidden') || errorMessage.includes('403') ||
        errorMessage.includes('invalid api key') || errorMessage.includes('api key')) {
      return res.status(500).json({ 
        error: 'Invalid or expired Neynar API key. Please check your NEYNAR_API_KEY environment variable.' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch Farcaster data. Please check your API key and try again.' 
    });
  }
} 