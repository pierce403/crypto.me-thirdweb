import { NextApiRequest, NextApiResponse } from 'next';

interface GitcoinStamp {
  credential?: {
    credentialSubject?: {
      provider?: string;
      hash?: string;
      context?: string[];
    };
  };
  provider?: string;
}

interface GitcoinStampsResponse {
  items?: GitcoinStamp[];
}

interface GitcoinScoreResponse {
  score?: string;
  last_score_timestamp?: string;
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

  const apiKey = process.env.GITCOIN_PASSPORT_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'Gitcoin Passport API key not configured. Please set GITCOIN_PASSPORT_API_KEY environment variable.' 
    });
  }

  try {
    // Get passport score
    const scoreResponse = await fetch(`https://api.scorer.gitcoin.co/registry/score/${process.env.GITCOIN_SCORER_ID || '1'}/${address}`, {
      headers: {
        'X-API-Key': apiKey,
        'accept': 'application/json',
      },
    });

    let score = 0;
    let lastUpdated = new Date().toISOString();
    
    if (scoreResponse.ok) {
      const scoreData: GitcoinScoreResponse = await scoreResponse.json();
      score = parseFloat(scoreData.score || '0');
      lastUpdated = scoreData.last_score_timestamp || lastUpdated;
    }

    // Get passport stamps
    const stampsResponse = await fetch(`https://api.scorer.gitcoin.co/registry/stamps/${address}`, {
      headers: {
        'X-API-Key': apiKey,
        'accept': 'application/json',
      },
    });

    let stamps: Array<{
      provider: string;
      verified: boolean;
      category: string;
    }> = [];

    if (stampsResponse.ok) {
      const stampsData: GitcoinStampsResponse = await stampsResponse.json();
      stamps = (stampsData.items || []).map((stamp: GitcoinStamp) => ({
        provider: stamp.credential?.credentialSubject?.provider || stamp.provider || 'Unknown',
        verified: stamp.credential?.credentialSubject?.hash ? true : false,
        category: stamp.credential?.credentialSubject?.context?.[0]?.split('/').pop()?.replace(/([A-Z])/g, ' $1').trim() || 'Other'
      }));
    }

    // Calculate trust level based on score
    let trustLevel = 'Low';
    if (score >= 20) {
      trustLevel = 'High';
    } else if (score >= 10) {
      trustLevel = 'Medium';
    }

    const result = {
      score,
      stamps,
      lastUpdated,
      trustLevel,
    };

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching Gitcoin Passport data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Gitcoin Passport data. Please check your API key and try again.' 
    });
  }
} 