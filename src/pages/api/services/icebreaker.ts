import { NextApiRequest, NextApiResponse } from 'next';

// Helper function to check if a string is an ENS name
function isENSName(address: string): boolean {
  return address.toLowerCase().endsWith('.eth');
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
    // Determine the correct endpoint based on input format
    let apiUrl: string;
    if (isENSName(address)) {
      apiUrl = `https://app.icebreaker.xyz/api/v1/ens/${address}`;
    } else {
      apiUrl = `https://app.icebreaker.xyz/api/v1/eth/${address}`;
    }

    console.log(`Fetching Icebreaker data from: ${apiUrl}`);

    // Icebreaker API is publicly accessible and doesn't require an API key
    const response = await fetch(apiUrl, {
      headers: {
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(200).json(null);
      }
      console.error(`Icebreaker API error: ${response.status} ${response.statusText}`);
      throw new Error(`Icebreaker API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Icebreaker raw response:', JSON.stringify(data, null, 2));

    // Check if we have profiles data
    if (!data.profiles || !Array.isArray(data.profiles) || data.profiles.length === 0) {
      return res.status(200).json(null);
    }

    // Get the first profile (there might be multiple, but we'll use the first one)
    const profile = data.profiles[0];

    // Extract social identities from channels
    const socialIdentities = profile.channels?.map((channel: {
      type: string;
      value: string;
      isVerified: boolean;
      url?: string;
    }) => ({
      platform: channel.type.toLowerCase(),
      username: channel.value,
      verified: channel.isVerified,
      url: channel.url
    })) || [];

    // Extract credentials information
    const credentials = profile.credentials?.map((credential: {
      name: string;
      chain?: string;
      source?: string;
      reference?: string;
    }) => ({
      name: credential.name,
      chain: credential.chain,
      source: credential.source,
      reference: credential.reference
    })) || [];

    // Build the response
    const icebreakerData = {
      profileID: profile.profileID,
      walletAddress: profile.walletAddress,
      displayName: profile.displayName,
      bio: profile.bio,
      location: profile.location,
      avatarUrl: profile.avatarUrl,
      socialIdentities,
      credentials,
      profileUrl: `https://app.icebreaker.xyz/profiles/${profile.profileID}`,
      verifiedChannelsCount: socialIdentities.filter((identity: { verified: boolean }) => identity.verified).length,
      totalChannelsCount: socialIdentities.length,
      credentialsCount: credentials.length
    };

    console.log('Formatted Icebreaker data:', JSON.stringify(icebreakerData, null, 2));

    res.status(200).json(icebreakerData);
  } catch (error) {
    console.error('Error fetching Icebreaker data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Icebreaker data. The service may be temporarily unavailable.' 
    });
  }
} 