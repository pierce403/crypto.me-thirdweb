import { NextApiRequest, NextApiResponse } from 'next';
import { createEnsPublicClient } from '@ensdomains/ensjs';
import { http } from 'viem';
import { mainnet } from 'viem/chains';

const ensClient = createEnsPublicClient({
  chain: mainnet,
  transport: http(),
});

// Helper function to check if a string is an ENS name
function isENSName(address: string): boolean {
  return address.toLowerCase().endsWith('.eth');
}

// Helper function to check if a string is an Ethereum address
function isEthereumAddress(input: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(input);
}

interface TokenBalance {
  symbol: string;
  name: string;
  amount: number;
  usdValue: number;
  price: number;
  logoUrl?: string;
}

interface ProtocolPosition {
  name: string;
  category: string; // 'Lending', 'DEX', 'Staking', etc.
  usdValue: number;
  positionType: string; // 'Supplied', 'Borrowed', 'LP', etc.
  logoUrl?: string;
}

interface DeBankResult {
  totalUSD: number;
  totalTokens: number;
  totalProtocols: number;
  topTokens: TokenBalance[];
  protocolPositions: ProtocolPosition[];
  portfolioUrl: string;
  lastUpdated: string;
  source: string;
  error?: string;
}

// Fetch data from DeBank API
async function fetchDeBankData(address: string): Promise<DeBankResult> {
  try {
    // Note: DeBank has rate limits and may require API key for production
    // For now, we'll implement with demo data that varies by user
    
    console.log(`Fetching DeBank data for: ${address}`);
    
    // In production, this would be:
    // const response = await fetch(`https://openapi.debank.com/v1/user/total_balance?id=${address}`);
    // const tokensResponse = await fetch(`https://openapi.debank.com/v1/user/token_list?id=${address}&is_all=false`);
    // const protocolsResponse = await fetch(`https://openapi.debank.com/v1/user/complex_protocol_list?id=${address}`);
    
    return getDemoDeBankData(address);

  } catch (error) {
    console.error('DeBank API error:', error);
    return getDemoDeBankData(address);
  }
}

function getDemoDeBankData(address: string): DeBankResult {
  // Generate user-specific demo data based on their address
  const addressHash = address.toLowerCase().split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  const userId = Math.abs(addressHash) % 1000;
  
  // Generate realistic portfolio values
  const baseValue = 5000 + (userId % 500) * 50; // $5k-$30k range
  const totalUSD = parseFloat((baseValue * (0.8 + (userId % 100) / 250)).toFixed(2));
  
  // Define token pools for variety
  const tokenPools = [
    [
      { symbol: 'ETH', name: 'Ethereum', baseValue: 0.4, logoUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
      { symbol: 'USDC', name: 'USD Coin', baseValue: 0.25, logoUrl: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png' },
      { symbol: 'UNI', name: 'Uniswap', baseValue: 0.15, logoUrl: 'https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png' },
      { symbol: 'AAVE', name: 'Aave', baseValue: 0.2, logoUrl: 'https://assets.coingecko.com/coins/images/12645/small/AAVE.png' }
    ],
    [
      { symbol: 'ETH', name: 'Ethereum', baseValue: 0.5, logoUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
      { symbol: 'WBTC', name: 'Wrapped Bitcoin', baseValue: 0.3, logoUrl: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png' },
      { symbol: 'COMP', name: 'Compound', baseValue: 0.2, logoUrl: 'https://assets.coingecko.com/coins/images/10775/small/COMP.png' }
    ],
    [
      { symbol: 'ETH', name: 'Ethereum', baseValue: 0.35, logoUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
      { symbol: 'USDT', name: 'Tether', baseValue: 0.3, logoUrl: 'https://assets.coingecko.com/coins/images/325/small/Tether-logo.png' },
      { symbol: 'LINK', name: 'Chainlink', baseValue: 0.2, logoUrl: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png' },
      { symbol: 'MKR', name: 'Maker', baseValue: 0.15, logoUrl: 'https://assets.coingecko.com/coins/images/1364/small/Mark_Maker.png' }
    ]
  ];
  
  const userTokenPool = tokenPools[userId % tokenPools.length];
  
  // Generate top tokens
  const topTokens: TokenBalance[] = userTokenPool.map((token, index) => {
    const usdValue = totalUSD * token.baseValue;
    const priceVariation = 0.8 + (userId + index) % 50 / 125; // Price variation
    const mockPrice = token.symbol === 'ETH' ? 2000 * priceVariation :
                     token.symbol === 'WBTC' ? 40000 * priceVariation :
                     token.symbol === 'USDC' || token.symbol === 'USDT' ? 1 :
                     100 * priceVariation;
    
    return {
      symbol: token.symbol,
      name: token.name,
      amount: parseFloat((usdValue / mockPrice).toFixed(6)),
      usdValue: parseFloat(usdValue.toFixed(2)),
      price: parseFloat(mockPrice.toFixed(2)),
      logoUrl: token.logoUrl
    };
  });
  
  // Generate protocol positions
  const protocolPools = [
    [
      { name: 'Aave V3', category: 'Lending', positionType: 'Supplied', baseValue: 0.3, logoUrl: 'https://assets.coingecko.com/coins/images/12645/small/AAVE.png' },
      { name: 'Uniswap V3', category: 'DEX', positionType: 'LP', baseValue: 0.4, logoUrl: 'https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png' },
      { name: 'Compound', category: 'Lending', positionType: 'Supplied', baseValue: 0.3, logoUrl: 'https://assets.coingecko.com/coins/images/10775/small/COMP.png' }
    ],
    [
      { name: 'Lido', category: 'Staking', positionType: 'Staked', baseValue: 0.5, logoUrl: 'https://assets.coingecko.com/coins/images/13442/small/steth_logo.png' },
      { name: 'Curve', category: 'DEX', positionType: 'LP', baseValue: 0.35, logoUrl: 'https://assets.coingecko.com/coins/images/12124/small/Curve.png' },
      { name: 'MakerDAO', category: 'Lending', positionType: 'Vault', baseValue: 0.15, logoUrl: 'https://assets.coingecko.com/coins/images/1364/small/Mark_Maker.png' }
    ],
    [
      { name: 'Rocket Pool', category: 'Staking', positionType: 'Staked', baseValue: 0.4, logoUrl: 'https://assets.coingecko.com/coins/images/20764/small/reth.png' },
      { name: 'Balancer', category: 'DEX', positionType: 'LP', baseValue: 0.35, logoUrl: 'https://assets.coingecko.com/coins/images/11683/small/Balancer.png' },
      { name: 'Yearn', category: 'Yield', positionType: 'Vault', baseValue: 0.25, logoUrl: 'https://assets.coingecko.com/coins/images/11849/small/yfi-192x192.png' }
    ]
  ];
  
  const userProtocolPool = protocolPools[userId % protocolPools.length];
  const defiValue = totalUSD * 0.4; // 40% of portfolio in DeFi
  
  const protocolPositions: ProtocolPosition[] = userProtocolPool.map(protocol => {
    const usdValue = defiValue * protocol.baseValue;
    return {
      name: protocol.name,
      category: protocol.category,
      usdValue: parseFloat(usdValue.toFixed(2)),
      positionType: protocol.positionType,
      logoUrl: protocol.logoUrl
    };
  });

  return {
    totalUSD,
    totalTokens: topTokens.length + (userId % 5) + 3, // 6-11 tokens
    totalProtocols: protocolPositions.length + (userId % 3), // 3-5 protocols
    topTokens,
    protocolPositions,
    portfolioUrl: `https://debank.com/profile/${address}`,
    lastUpdated: new Date().toISOString(),
    source: 'demo'
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

  let resolvedAddress = address;

  // If input looks like an ENS name, resolve it to an address
  if (isENSName(address)) {
    try {
      const addressRecord = await ensClient.getAddressRecord({ name: address });
      if (!addressRecord?.value || addressRecord.value === '0x0000000000000000000000000000000000000000') {
        return res.status(404).json({ error: 'ENS name not found or not resolved to a valid address' });
      }
      resolvedAddress = addressRecord.value;
      console.log(`Resolved ${address} to ${resolvedAddress}`);
    } catch (error) {
      console.error('Error resolving ENS name:', error);
      return res.status(400).json({ error: 'Invalid ENS name or resolution failed' });
    }
  } else if (!isEthereumAddress(address)) {
    return res.status(400).json({ error: 'Invalid Ethereum address or ENS name format' });
  }

  console.log(`Fetching DeBank portfolio data for: ${resolvedAddress}`);

  try {
    const result = await fetchDeBankData(resolvedAddress);
    return res.status(200).json(result);
  } catch (error) {
    console.error('DeBank service error:', error);
    
    return res.status(200).json({
      totalUSD: 0,
      totalTokens: 0,
      totalProtocols: 0,
      topTokens: [],
      protocolPositions: [],
      portfolioUrl: `https://debank.com/profile/${resolvedAddress}`,
      lastUpdated: new Date().toISOString(),
      source: 'none',
      error: 'SERVICE_ERROR'
    });
  }
} 