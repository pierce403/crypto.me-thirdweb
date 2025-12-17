import { NextApiRequest, NextApiResponse } from 'next';
import { createEnsPublicClient } from '@ensdomains/ensjs';
import { http } from 'viem';
import { mainnet } from 'viem/chains';

const alchemyRpcUrl =
  process.env.ALCHEMY_RPC_URL ||
  (process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined);

const rpcUrl = alchemyRpcUrl ?? 'https://rpc.ankr.com/eth';

const ensClient = createEnsPublicClient({
  chain: mainnet,
  transport: http(rpcUrl, { timeout: 8000, retryCount: 1, retryDelay: 300 }),
});

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

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
      const apiKey = process.env.DEBANK_API_KEY;
      // const apiKey = ''; // Force missing key for UI testing

      if (!apiKey) {
        const noApiKeyResult: DeBankResult = {
          totalUSD: 0,
          totalTokens: 0,
          totalProtocols: 0,
          topTokens: [],
          protocolPositions: [],
          portfolioUrl: `https://debank.com/profile/${resolvedAddress}`,
          lastUpdated: new Date().toISOString(),
          source: 'none',
          error: 'NO_API_KEY'
        };

        return res.status(200).json(noApiKeyResult);
      }

      // Real DeBank Open API calls
      const [balanceRes, tokensRes, protocolsRes] = await Promise.all([
        fetch(`https://openapi.debank.com/v1/user/total_balance?id=${resolvedAddress}`, {
          headers: { 'AccessKey': apiKey }
        }),
        fetch(`https://openapi.debank.com/v1/user/token_list?id=${resolvedAddress}&is_all=false`, {
          headers: { 'AccessKey': apiKey }
        }),
        fetch(`https://openapi.debank.com/v1/user/complex_protocol_list?id=${resolvedAddress}`, {
          headers: { 'AccessKey': apiKey }
        })
      ]);

      if (!balanceRes.ok) {
        console.error(`DeBank API error: ${balanceRes.status} ${balanceRes.statusText}`);
        // Fallback to error
        throw new Error(`DeBank API error: ${balanceRes.status}`);
      }

      const balanceData: unknown = await balanceRes.json();
      const tokensData: unknown = tokensRes.ok ? await tokensRes.json() : [];
      const protocolsData: unknown = protocolsRes.ok ? await protocolsRes.json() : [];

      // Map Token Data
      const topTokens: TokenBalance[] = Array.isArray(tokensData)
        ? tokensData.slice(0, 5).flatMap((tokenUnknown) => {
          if (!isRecord(tokenUnknown)) return [];

          const symbol = typeof tokenUnknown.symbol === 'string' ? tokenUnknown.symbol : 'UNKNOWN';
          const name = typeof tokenUnknown.name === 'string' ? tokenUnknown.name : symbol;
          const amount = typeof tokenUnknown.amount === 'number' ? tokenUnknown.amount : 0;
          const price = typeof tokenUnknown.price === 'number' ? tokenUnknown.price : 0;
          const logoUrl = typeof tokenUnknown.logo_url === 'string' ? tokenUnknown.logo_url : undefined;

          return [{
            symbol,
            name,
            amount,
            usdValue: amount * price,
            price,
            logoUrl,
          }];
        })
        : [];

      // Map Protocol Data
      const protocolPositions: ProtocolPosition[] = [];
      if (Array.isArray(protocolsData)) {
        for (const protocolUnknown of protocolsData) {
          if (!isRecord(protocolUnknown)) continue;

          const protocolName = typeof protocolUnknown.name === 'string' ? protocolUnknown.name : 'Protocol';
          const protocolLogoUrl =
            typeof protocolUnknown.logo_url === 'string' ? protocolUnknown.logo_url : undefined;
          const portfolioItemList = protocolUnknown.portfolio_item_list;

          if (!Array.isArray(portfolioItemList)) continue;

          for (const itemUnknown of portfolioItemList) {
            if (!isRecord(itemUnknown)) continue;

            const stats = itemUnknown.stats;
            const netUsdValue =
              isRecord(stats) && typeof stats.net_usd_value === 'number' ? stats.net_usd_value : 0;
            const positionType = typeof itemUnknown.name === 'string' ? itemUnknown.name : 'Position';

            protocolPositions.push({
              name: protocolName,
              category: 'DeFi',
              usdValue: netUsdValue,
              positionType,
              logoUrl: protocolLogoUrl,
            });
          }
        }
      }

      // Sort positions by value
      protocolPositions.sort((a, b) => b.usdValue - a.usdValue);

      const totalUSD =
        isRecord(balanceData) && typeof balanceData.total_usd_value === 'number'
          ? balanceData.total_usd_value
          : 0;
      const totalProtocols = Array.isArray(protocolsData) ? protocolsData.length : 0;

      const result: DeBankResult = {
        totalUSD,
        totalTokens: topTokens.length, // approximation or usage of tokensData.length
        totalProtocols,
        topTokens: topTokens,
        protocolPositions: protocolPositions.slice(0, 5),
        portfolioUrl: `https://debank.com/profile/${resolvedAddress}`,
        lastUpdated: new Date().toISOString(),
        source: 'debank',
        error: undefined
      };

      return res.status(200).json(result);

    } catch (error) {
      console.error('DeBank service error:', error);

      const serviceErrorResult: DeBankResult = {
        totalUSD: 0,
        totalTokens: 0,
        totalProtocols: 0,
        topTokens: [],
        protocolPositions: [],
        portfolioUrl: `https://debank.com/profile/${resolvedAddress}`,
        lastUpdated: new Date().toISOString(),
        source: 'none',
        error: 'SERVICE_ERROR'
      };

      return res.status(200).json(serviceErrorResult);
    }
  };
}

export default createHandler();
