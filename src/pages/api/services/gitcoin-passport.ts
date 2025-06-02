import { NextApiRequest, NextApiResponse } from 'next';

// Helper function to check if a string is an ENS name
function isENSName(address: string): boolean {
  return address.toLowerCase().endsWith('.eth');
}

// Helper function to resolve ENS to address
async function resolveENSToAddress(ensName: string): Promise<string> {
  try {
    const response = await fetch(`https://api.ensideas.com/ens/resolve/${ensName}`);
    if (response.ok) {
      const data = await response.json();
      return data.address || ensName;
    }
  } catch (error) {
    console.error('ENS resolution error:', error);
  }
  return ensName;
}

interface GitcoinPassportResult {
  score: number;
  stamps: Array<{
    provider: string;
    verified: boolean;
    category: string;
  }>;
  lastUpdated: string;
  trustLevel: string;
  passportUrl: string;
  humanPassportUrl: string;
  source: string;
  error?: string;
}

interface StampItem {
  credential?: {
    credentialSubject?: {
      provider?: string;
      hash?: string;
      context?: string[];
    };
  };
}

interface StampsResponse {
  items?: StampItem[];
}

interface ScoreResponse {
  score?: string;
  last_score_timestamp?: string;
}

// Try to fetch from the new Human Passport API (free tier)
async function tryHumanPassportAPI(address: string): Promise<GitcoinPassportResult | null> {
  const apiKey = process.env.GITCOIN_PASSPORT_API_KEY;
  const scorerId = process.env.GITCOIN_SCORER_ID || '1';
  
  if (!apiKey) {
    return null;
  }

  try {
    // Try the new Human Passport API endpoint first
    const scoreResponse = await fetch(`https://api.passport.xyz/v2/stamps/${scorerId}/score/${address}`, {
      headers: {
        'X-API-Key': apiKey,
        'accept': 'application/json',
      },
    });

    if (scoreResponse.ok) {
      const scoreData: ScoreResponse = await scoreResponse.json();
      const score = parseFloat(scoreData.score || '0');
      
      // Get stamps data
      const stampsResponse = await fetch(`https://api.passport.xyz/v2/stamps/${address}`, {
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
        const stampsData: StampsResponse = await stampsResponse.json();
        stamps = (stampsData.items || []).slice(0, 10).map((item: StampItem) => ({
          provider: item.credential?.credentialSubject?.provider || 'Unknown',
          verified: !!item.credential?.credentialSubject?.hash,
          category: item.credential?.credentialSubject?.context?.[0]?.split('/').pop()?.replace(/([A-Z])/g, ' $1').trim() || 'Other'
        }));
      }

      // Calculate trust level based on score
      let trustLevel = 'Low';
      if (score >= 20) {
        trustLevel = 'High';
      } else if (score >= 10) {
        trustLevel = 'Medium';
      }

      return {
        score,
        stamps,
        lastUpdated: scoreData.last_score_timestamp || new Date().toISOString(),
        trustLevel,
        passportUrl: `https://passport.human.tech/`,
        humanPassportUrl: `https://passport.human.tech/`,
        source: 'human-passport'
      };
    }
  } catch (error) {
    console.error('Human Passport API error:', error);
  }

  return null;
}

// Provide educational information about Gitcoin Passport scoring
function getPassportEducationalInfo(): GitcoinPassportResult {
  return {
    score: 0,
    stamps: [
      {
        provider: 'ENS',
        verified: false,
        category: 'Identity'
      },
      {
        provider: 'Twitter',
        verified: false,
        category: 'Social'
      },
      {
        provider: 'Discord',
        verified: false,
        category: 'Social'
      },
      {
        provider: 'GitHub',
        verified: false,
        category: 'Developer'
      },
      {
        provider: 'BrightID',
        verified: false,
        category: 'Identity'
      }
    ],
    lastUpdated: new Date().toISOString(),
    trustLevel: 'Unknown',
    passportUrl: `https://passport.human.tech/`,
    humanPassportUrl: `https://passport.human.tech/`,
    source: 'educational',
    error: 'NO_API_ACCESS'
  };
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

  // Resolve ENS to address if needed
  let resolvedAddress = address;
  if (isENSName(address)) {
    resolvedAddress = await resolveENSToAddress(address);
    console.log(`Resolved ${address} to ${resolvedAddress}`);
  }

  console.log(`Fetching Gitcoin Passport data for address: ${resolvedAddress}`);

  try {
    // Try the Human Passport API first
    const humanPassportResult = await tryHumanPassportAPI(resolvedAddress);
    
    if (humanPassportResult) {
      console.log(`Successfully fetched data from Human Passport API`);
      return res.status(200).json(humanPassportResult);
    }

    // If no API access, provide educational information
    console.log('No API access available, providing educational information');
    const educationalResult = getPassportEducationalInfo();
    
    return res.status(200).json(educationalResult);

  } catch (error) {
    console.error('Gitcoin Passport fetch error:', error);
    
    // Fallback to educational information
    const fallbackResult = getPassportEducationalInfo();
    fallbackResult.error = 'API_ERROR';
    
    return res.status(200).json(fallbackResult);
  }
} 