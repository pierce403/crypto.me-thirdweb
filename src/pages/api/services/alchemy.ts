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

const ALCHEMY_NETWORKS = [
  'eth-mainnet',
  'base-mainnet',
  'arb-mainnet',
  'opt-mainnet',
  'polygon-mainnet',
] as const;
const ALCHEMY_NETWORK_SET = new Set<string>(ALCHEMY_NETWORKS);
const MAX_PAGES = 3;
const MAX_TOP_HOLDINGS = 8;
const PROVIDER_TIMEOUT_MS = 3500;
const MAX_BALANCE_CHARACTERS = 256;

type UnknownRecord = Record<string, unknown>;

interface AlchemyHolding {
  network: string;
  tokenAddress: string | null;
  symbol: string;
  name: string;
  logoUrl?: string;
  balance: string;
  usdPrice: number;
  usdValue: number;
}

interface AlchemyResult {
  totalValueUsd: number;
  totalHoldings: number;
  topHoldings: AlchemyHolding[];
  networks: string[];
  source: 'alchemy' | 'none';
  error?: string;
  // Preserve the empty legacy field on failures while cached clients transition
  // from this route's former NFT response.
  nfts?: [];
}

interface PortfolioPage {
  tokens: unknown[];
  pageKey?: string;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isENSName(address: string): boolean {
  return address.toLowerCase().endsWith('.eth');
}

function isEthereumAddress(input: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(input);
}

function emptyResult(error: string): AlchemyResult {
  return {
    totalValueUsd: 0,
    totalHoldings: 0,
    topHoldings: [],
    networks: [...ALCHEMY_NETWORKS],
    source: 'none',
    error,
    nfts: [],
  };
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readDisplayString(value: unknown, fallback: string): string {
  const parsed = readNonEmptyString(value);
  return parsed ? parsed.slice(0, 160) : fallback;
}

function readPositiveNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function readDecimals(value: unknown): number | undefined {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN;

  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 36 ? parsed : undefined;
}

function formatAtomicBalance(value: unknown, decimals: number): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_BALANCE_CHARACTERS) {
    return undefined;
  }

  let atomic: bigint;
  try {
    if (/^0x[0-9a-f]+$/i.test(value) || /^\d+$/.test(value)) {
      atomic = BigInt(value);
    } else {
      return undefined;
    }
  } catch {
    return undefined;
  }

  if (atomic < BigInt(0)) return undefined;

  const scale = BigInt(10) ** BigInt(decimals);
  const whole = atomic / scale;
  const fractional = atomic % scale;

  if (fractional === BigInt(0)) return whole.toString();

  const fractionalText = fractional
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '');

  return `${whole}.${fractionalText}`;
}

function readHttpUrl(value: unknown): string | undefined {
  const candidate = readNonEmptyString(value);
  if (!candidate) return undefined;

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? candidate : undefined;
  } catch {
    return undefined;
  }
}

function isExplicitSpamValue(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value !== 'string') return false;

  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === 'spam';
}

function hasSpamClassification(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => readNonEmptyString(item) !== undefined);
}

function isSpamToken(token: UnknownRecord, metadata: UnknownRecord): boolean {
  const spamInfo = isRecord(token.spamInfo) ? token.spamInfo : {};
  const records = [token, metadata, spamInfo];

  return records.some((record) =>
    isExplicitSpamValue(record.isSpam) ||
    isExplicitSpamValue(record.spam) ||
    hasSpamClassification(record.spamClassifications)
  );
}

function readUsdPrice(token: UnknownRecord): number | undefined {
  if (!Array.isArray(token.tokenPrices)) return undefined;

  for (const priceUnknown of token.tokenPrices) {
    if (!isRecord(priceUnknown)) continue;
    const currency = readNonEmptyString(priceUnknown.currency)?.toLowerCase();
    if (currency !== 'usd') continue;

    const price = readPositiveNumber(priceUnknown.value);
    if (price !== undefined) return price;
  }

  return undefined;
}

function readDirectUsdValue(token: UnknownRecord): number | undefined {
  return (
    readPositiveNumber(token.usdValue) ??
    readPositiveNumber(token.valueUsd) ??
    readPositiveNumber(token.tokenValueUsd)
  );
}

function nativeSymbolForNetwork(network: string): string {
  return network === 'polygon-mainnet' ? 'POL' : 'ETH';
}

function parseHolding(tokenUnknown: unknown, requestedAddress: string): AlchemyHolding | undefined {
  if (!isRecord(tokenUnknown)) return undefined;

  const tokenOwner = readNonEmptyString(tokenUnknown.address);
  if (tokenOwner && tokenOwner.toLowerCase() !== requestedAddress.toLowerCase()) return undefined;

  const network = readNonEmptyString(tokenUnknown.network);
  if (!network || !ALCHEMY_NETWORK_SET.has(network)) return undefined;

  const metadata = isRecord(tokenUnknown.tokenMetadata) ? tokenUnknown.tokenMetadata : {};
  if (isSpamToken(tokenUnknown, metadata)) return undefined;

  const decimals = readDecimals(metadata.decimals);
  if (decimals === undefined) return undefined;

  const balance = formatAtomicBalance(tokenUnknown.tokenBalance, decimals);
  if (!balance) return undefined;

  const numericBalance = Number(balance);
  if (!Number.isFinite(numericBalance) || numericBalance <= 0) return undefined;

  const providerUsdValue = readDirectUsdValue(tokenUnknown);
  const providerUsdPrice = readUsdPrice(tokenUnknown);
  const computedUsdValue =
    providerUsdPrice === undefined ? undefined : numericBalance * providerUsdPrice;
  const usdValue =
    providerUsdValue ??
    (computedUsdValue !== undefined && Number.isFinite(computedUsdValue) && computedUsdValue > 0
      ? computedUsdValue
      : undefined);

  if (usdValue === undefined) return undefined;

  const usdPrice =
    providerUsdPrice ??
    (Number.isFinite(usdValue / numericBalance) && usdValue / numericBalance > 0
      ? usdValue / numericBalance
      : undefined);

  if (usdPrice === undefined) return undefined;

  const rawTokenAddress = tokenUnknown.tokenAddress;
  const tokenAddress =
    rawTokenAddress === null || rawTokenAddress === undefined || rawTokenAddress === ''
      ? null
      : typeof rawTokenAddress === 'string' && isEthereumAddress(rawTokenAddress)
        ? rawTokenAddress
        : undefined;

  if (tokenAddress === undefined) return undefined;

  const fallbackSymbol = tokenAddress ? 'TOKEN' : nativeSymbolForNetwork(network);
  const symbol = readDisplayString(metadata.symbol, fallbackSymbol);
  const name = readDisplayString(metadata.name, symbol);
  const logoUrl = readHttpUrl(metadata.logo);

  return {
    network,
    tokenAddress,
    symbol,
    name,
    ...(logoUrl ? { logoUrl } : {}),
    balance,
    usdPrice,
    usdValue,
  };
}

function parsePortfolioPage(value: unknown): PortfolioPage | undefined {
  if (!isRecord(value) || !isRecord(value.data) || !Array.isArray(value.data.tokens)) {
    return undefined;
  }

  const rawPageKey = value.data.pageKey;
  if (
    rawPageKey !== undefined &&
    rawPageKey !== null &&
    typeof rawPageKey !== 'string'
  ) {
    return undefined;
  }

  const pageKey = readNonEmptyString(rawPageKey);
  return {
    tokens: value.data.tokens,
    ...(pageKey ? { pageKey } : {}),
  };
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
}

const defaultDependencies = {
  ensClient,
  fetchFn: fetch,
};

export function createHandler(dependencies = defaultDependencies) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { fetchFn, ensClient } = dependencies;

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { address } = req.query;

    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Address is required' });
    }

    let resolvedAddress = address;

    if (isENSName(address)) {
      try {
        const addressRecord = await ensClient.getAddressRecord({ name: address });
        if (
          !addressRecord?.value ||
          addressRecord.value === '0x0000000000000000000000000000000000000000' ||
          !isEthereumAddress(addressRecord.value)
        ) {
          return res.status(404).json({ error: 'ENS name not found or not resolved to a valid address' });
        }
        resolvedAddress = addressRecord.value;
      } catch (error) {
        const errorName = error instanceof Error ? error.name : 'UnknownError';
        console.error(JSON.stringify({ event: 'alchemy_ens_resolution_error', errorName }));
        return res.status(400).json({ error: 'Invalid ENS name or resolution failed' });
      }
    } else if (!isEthereumAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address or ENS name format' });
    }

    const alchemyApiKey = process.env.ALCHEMY_API_KEY;
    if (!alchemyApiKey) {
      return res.status(200).json(emptyResult('NO_API_KEY'));
    }

    const endpoint =
      `https://api.g.alchemy.com/data/v1/${encodeURIComponent(alchemyApiKey)}` +
      '/assets/tokens/by-address';
    const baseBody = {
      addresses: [{
        address: resolvedAddress,
        networks: [...ALCHEMY_NETWORKS],
      }],
      withMetadata: true,
      withPrices: true,
      includeNativeTokens: true,
      includeErc20Tokens: true,
    };

    try {
      const holdingsByAsset = new Map<string, AlchemyHolding>();
      const seenPageKeys = new Set<string>();
      let pageKey: string | undefined;

      for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
        const response = await fetchFn(endpoint, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pageKey ? { ...baseBody, pageKey } : baseBody),
          cache: 'no-store',
          signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        });

        if (!response.ok) {
          console.error(JSON.stringify({
            event: 'alchemy_portfolio_http_error',
            status: response.status,
          }));
          return res.status(200).json(emptyResult('API_ERROR'));
        }

        const responseBody: unknown = await response.json();
        const page = parsePortfolioPage(responseBody);
        if (!page) {
          console.error(JSON.stringify({ event: 'alchemy_portfolio_invalid_response' }));
          return res.status(200).json(emptyResult('INVALID_RESPONSE'));
        }

        for (const tokenUnknown of page.tokens) {
          const holding = parseHolding(tokenUnknown, resolvedAddress);
          if (!holding) continue;

          const assetKey = `${holding.network}:${holding.tokenAddress?.toLowerCase() ?? 'native'}`;
          const existing = holdingsByAsset.get(assetKey);
          if (!existing || holding.usdValue > existing.usdValue) {
            holdingsByAsset.set(assetKey, holding);
          }
        }

        pageKey = page.pageKey;
        if (!pageKey || seenPageKeys.has(pageKey)) break;
        seenPageKeys.add(pageKey);
      }

      const holdings = [...holdingsByAsset.values()].sort((left, right) =>
        right.usdValue - left.usdValue ||
        left.symbol.localeCompare(right.symbol) ||
        left.network.localeCompare(right.network)
      );
      const totalValueUsd = holdings.reduce((sum, holding) => sum + holding.usdValue, 0);

      return res.status(200).json({
        totalValueUsd: Number.isFinite(totalValueUsd) ? totalValueUsd : 0,
        totalHoldings: holdings.length,
        topHoldings: holdings.slice(0, MAX_TOP_HOLDINGS),
        networks: [...ALCHEMY_NETWORKS],
        source: 'alchemy',
      } satisfies AlchemyResult);
    } catch (error) {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      console.error(JSON.stringify({
        event: 'alchemy_portfolio_fetch_error',
        errorName,
      }));
      return res.status(200).json(emptyResult(isTimeoutError(error) ? 'TIMEOUT' : 'FETCH_ERROR'));
    }
  };
}

export default createHandler();
