import { NextApiRequest, NextApiResponse } from 'next';
import { createEnsPublicClient } from '@ensdomains/ensjs';
import { http } from 'viem';
import { mainnet } from 'viem/chains';

const alchemyRpcUrl =
  process.env.ALCHEMY_RPC_URL ||
  (process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined);

const ensClient = createEnsPublicClient({
  chain: mainnet,
  transport: http('https://rpc.ankr.com/eth', { timeout: 8000, retryCount: 1, retryDelay: 300 }),
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



const defaultDependencies = {
  ensClient,
};

export function createHandler(dependencies = defaultDependencies) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { ensClient } = dependencies;

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
      // In production, this would be:
      // const response = await fetch(`https://openapi.debank.com/v1/user/total_balance?id=${resolvedAddress}`);
      // const tokensResponse = await fetch(`https://openapi.debank.com/v1/user/token_list?id=${resolvedAddress}&is_all=false`);
      // const protocolsResponse = await fetch(`https://openapi.debank.com/v1/user/complex_protocol_list?id=${resolvedAddress}`);
      // const result = await response.json(); // Or combine data from multiple responses

      // const result = getDemoDeBankData(resolvedAddress);

      console.log('DeBank API integration pending. Returning empty state as per user request (no fake data).');
      return res.status(200).json({
        totalUSD: 0,
        totalTokens: 0,
        totalProtocols: 0,
        topTokens: [],
        protocolPositions: [],
        portfolioUrl: `https://debank.com/profile/${resolvedAddress}`,
        lastUpdated: new Date().toISOString(),
        source: 'none',
        error: 'API_INTEGRATION_PENDING'
      });
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
  };
}

export default createHandler();
