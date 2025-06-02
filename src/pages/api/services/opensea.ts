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

interface ProcessedNFT {
  name: string;
  collection: string;
  image: string;
  value: number;
  currency: string;
  permalink: string;
  description?: string;
}

interface NFTResult {
  profileUrl: string;
  topNFTs: ProcessedNFT[];
  totalValue: number;
  source: string;
  error?: string;
}

// NFTScan API response types
interface NFTScanNFT {
  name?: string;
  collection_name?: string;
  image_uri?: string;
  contract_address: string;
  token_id: string;
  description?: string;
}

interface NFTScanResponse {
  data?: {
    content?: NFTScanNFT[];
  };
}

// The Graph API response types
interface GraphToken {
  contract: {
    id: string;
    name?: string;
    symbol?: string;
  };
  tokenID: string;
}

interface GraphResponse {
  data?: {
    tokens?: GraphToken[];
  };
}

// Try to fetch NFTs using blockchain data directly (free!)
async function fetchNFTsFromBlockchain(address: string): Promise<ProcessedNFT[]> {
  try {
    // Use a free Ethereum RPC endpoint to query ERC721 Transfer events
    // This is a basic implementation - you could enhance it with more detailed parsing
    const response = await fetch('https://ethereum-rpc.publicnode.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [{
          fromBlock: 'earliest',
          toBlock: 'latest',
          topics: [
            '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // ERC721 Transfer event
            null,
            `0x000000000000000000000000${address.slice(2).toLowerCase()}` // to address
          ]
        }],
        id: 1
      })
    });

    if (response.ok) {
      console.log('Blockchain query successful, but parsing NFT data from logs is complex');
      // Note: This would require complex parsing of transfer logs
      // For now, return empty array but this shows the approach
      return [];
    }
  } catch (error) {
    console.error('Blockchain query error:', error);
  }
  return [];
}

// Try to fetch NFTs using NFTScan free API
async function fetchNFTsFromNFTScan(address: string): Promise<ProcessedNFT[]> {
  try {
    // NFTScan has a free tier
    const response = await fetch(`https://restapi.nftscan.com/api/v2/account/own/${address}?erc_type=erc721&show_attribute=false&sort_field=&sort_direction=&limit=10`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data: NFTScanResponse = await response.json();
      console.log('NFTScan response:', data);
      
      if (data.data && data.data.content) {
        return data.data.content.slice(0, 5).map((nft: NFTScanNFT) => ({
          name: nft.name || 'Unnamed NFT',
          collection: nft.collection_name || 'Unknown Collection',
          image: nft.image_uri || '',
          value: 0,
          currency: 'ETH',
          permalink: `https://opensea.io/assets/ethereum/${nft.contract_address}/${nft.token_id}`,
          description: nft.description
        }));
      }
    }
  } catch (error) {
    console.error('NFTScan API error:', error);
  }
  return [];
}

// Try to fetch NFTs using Bitquery (has free tier)
async function fetchNFTsFromBitquery(address: string): Promise<ProcessedNFT[]> {
  try {
    const query = `
      query {
        ethereum {
          transfers(
            currency: {is: "ETH"}
            receiver: {is: "${address}"}
            options: {limit: 10, desc: "block.timestamp.time"}
          ) {
            currency {
              address
              symbol
              name
            }
            block {
              timestamp {
                time
              }
            }
            transaction {
              hash
            }
          }
        }
      }
    `;

    const response = await fetch('https://graphql.bitquery.io/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });

    if (response.ok) {
      console.log('Bitquery response received');
      // Parse Bitquery response for NFT data
      // This is a simplified implementation
      return [];
    }
  } catch (error) {
    console.error('Bitquery API error:', error);
  }
  return [];
}

// Try to fetch NFTs using The Graph (free!)
async function fetchNFTsFromTheGraph(address: string): Promise<ProcessedNFT[]> {
  try {
    // Use a public subgraph for NFTs
    const query = `
      {
        tokens(where: {owner: "${address.toLowerCase()}"}, first: 10, orderBy: transferredAt, orderDirection: desc) {
          id
          tokenID
          tokenURI
          contract {
            id
            name
            symbol
          }
          owner {
            id
          }
        }
      }
    `;

    const response = await fetch('https://api.thegraph.com/subgraphs/name/cryptopunksnotdead/eip721-subgraph', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });

    if (response.ok) {
      const data: GraphResponse = await response.json();
      console.log('The Graph response:', data);
      
      if (data.data && data.data.tokens) {
        return data.data.tokens.slice(0, 5).map((token: GraphToken) => ({
          name: token.contract.name || 'Unnamed NFT',
          collection: token.contract.name || 'Unknown Collection',
          image: '', // Would need to fetch from tokenURI
          value: 0,
          currency: 'ETH',
          permalink: `https://opensea.io/assets/ethereum/${token.contract.id}/${token.tokenID}`,
          description: ''
        }));
      }
    }
  } catch (error) {
    console.error('The Graph API error:', error);
  }
  return [];
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

  console.log(`Fetching NFTs for address: ${resolvedAddress}`);

  // Always provide OpenSea profile link regardless of API availability
  const profileUrl = `https://opensea.io/${resolvedAddress}`;

  // Try multiple free data sources in order
  let nfts: ProcessedNFT[] = [];
  let source = 'none';

  try {
    // Try NFTScan first (has good free tier)
    console.log('Trying NFTScan...');
    nfts = await fetchNFTsFromNFTScan(resolvedAddress);
    if (nfts.length > 0) {
      source = 'nftscan';
      console.log(`Found ${nfts.length} NFTs from NFTScan`);
    }

    // If no results, try The Graph
    if (nfts.length === 0) {
      console.log('Trying The Graph...');
      nfts = await fetchNFTsFromTheGraph(resolvedAddress);
      if (nfts.length > 0) {
        source = 'thegraph';
        console.log(`Found ${nfts.length} NFTs from The Graph`);
      }
    }

    // If no results, try Bitquery
    if (nfts.length === 0) {
      console.log('Trying Bitquery...');
      nfts = await fetchNFTsFromBitquery(resolvedAddress);
      if (nfts.length > 0) {
        source = 'bitquery';
        console.log(`Found ${nfts.length} NFTs from Bitquery`);
      }
    }

    // If still no results, try blockchain directly
    if (nfts.length === 0) {
      console.log('Trying direct blockchain query...');
      nfts = await fetchNFTsFromBlockchain(resolvedAddress);
      if (nfts.length > 0) {
        source = 'blockchain';
        console.log(`Found ${nfts.length} NFTs from blockchain`);
      }
    }

    const result: NFTResult = {
      profileUrl,
      topNFTs: nfts,
      totalValue: 0, // Free APIs typically don't provide pricing
      source
    };

    return res.status(200).json(result);

  } catch (error) {
    console.error('NFT fetch error:', error);
    
    return res.status(200).json({
      profileUrl,
      topNFTs: [],
      totalValue: 0,
      source: 'none',
      error: 'API_ERROR'
    });
  }
} 