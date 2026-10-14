import { NextApiRequest, NextApiResponse } from 'next';
import { addEnsContracts, createEnsPublicClient } from '@ensdomains/ensjs';
import { http } from 'viem';
import { mainnet } from 'viem/chains';

const alchemyRpcUrl =
  process.env.ALCHEMY_RPC_URL ||
  (process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined);

const rpcUrl = alchemyRpcUrl ?? 'https://rpc.ankr.com/eth';

const ensClient = createEnsPublicClient({
  chain: addEnsContracts(mainnet),
  transport: http(rpcUrl, { timeout: 8000, retryCount: 1, retryDelay: 300 }),
});

const ALCHEMY_NETWORKS = [
  'eth-mainnet',
  'base-mainnet',
  'arb-mainnet',
  'opt-mainnet',
  'polygon-mainnet',
] as const;
type AlchemyNetwork = (typeof ALCHEMY_NETWORKS)[number];
const NETWORK_CONFIG: Record<AlchemyNetwork, {
  chainId: string;
  maxEtherscanPages: number;
}> = {
  'eth-mainnet': { chainId: '1', maxEtherscanPages: 5 },
  'base-mainnet': { chainId: '8453', maxEtherscanPages: 2 },
  'arb-mainnet': { chainId: '42161', maxEtherscanPages: 2 },
  'opt-mainnet': { chainId: '10', maxEtherscanPages: 2 },
  'polygon-mainnet': { chainId: '137', maxEtherscanPages: 2 },
};
const ALCHEMY_NETWORK_SET = new Set<string>(ALCHEMY_NETWORKS);
const ALCHEMY_SCHEMA_VERSION = 4;
const MAX_PAGES_PER_NETWORK = 1;
const DEFAULT_PAGE_LIMITS: Record<AlchemyNetwork, number> = {
  'eth-mainnet': 1,
  'base-mainnet': 1,
  'arb-mainnet': 1,
  'opt-mainnet': 1,
  'polygon-mainnet': 1,
};
const MAX_TOP_HOLDINGS = 8;
const PROVIDER_TIMEOUT_MS = 3000;
const SCAN_TIMEOUT_MS = 14000;
const MIN_REQUEST_TIMEOUT_MS = 250;
const MAX_BALANCE_CHARACTERS = 256;
const ETHERSCAN_PAGE_SIZE = 100;
const ETHERSCAN_REQUEST_INTERVAL_MS = 550;
const PROFILE_REFRESH_HEADER = 'x-crypto-me-refresh-token';

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
  schemaVersion: typeof ALCHEMY_SCHEMA_VERSION;
  totalValueUsd: number;
  totalHoldings: number;
  topHoldings: AlchemyHolding[];
  networks: string[];
  source: 'etherscan+alchemy' | 'etherscan' | 'alchemy' | 'none';
  isPartial: boolean;
  valueSemantics: 'priced-total' | 'priced-lower-bound' | 'native-only' | 'unavailable';
  scanComplete: boolean;
  nativeComplete: boolean;
  pagesFetched: number;
  incompleteNetworks: string[];
  networkScans: Record<string, {
    pagesFetched: number;
    scanComplete: boolean;
    nativeFetched?: boolean;
    etherscanPagesFetched?: number;
  }>;
  requiresEtherscanApiKey?: boolean;
  warning?: 'ETHERSCAN_API_KEY_REQUIRED' | 'ETHERSCAN_API_UNAVAILABLE';
  error?: string;
  // Preserve the empty legacy field on failures while cached clients transition
  // from this route's former NFT response.
  nfts?: [];
}

interface PortfolioPage {
  tokens: unknown[];
  pageKey?: string;
}

interface PortfolioScanResult {
  tokens: unknown[];
  pagesFetched: number;
  scanComplete: boolean;
  error?: 'API_ERROR' | 'INVALID_RESPONSE' | 'TIMEOUT' | 'FETCH_ERROR' | 'SCAN_DEADLINE' | 'PAGE_LIMIT' | 'REPEATED_PAGE_KEY';
}

interface EtherscanScanResult {
  holdings: AlchemyHolding[];
  pagesFetched: number;
  scanComplete: boolean;
  incompleteNetworks: AlchemyNetwork[];
  networkScans: Record<AlchemyNetwork, {
    pagesFetched: number;
    scanComplete: boolean;
  }>;
  error?: 'API_ERROR' | 'INVALID_RESPONSE' | 'TIMEOUT' | 'FETCH_ERROR' | 'SCAN_DEADLINE';
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
    schemaVersion: ALCHEMY_SCHEMA_VERSION,
    totalValueUsd: 0,
    totalHoldings: 0,
    topHoldings: [],
    networks: [...ALCHEMY_NETWORKS],
    source: 'none',
    isPartial: true,
    valueSemantics: 'unavailable',
    scanComplete: false,
    nativeComplete: false,
    pagesFetched: 0,
    incompleteNetworks: [...ALCHEMY_NETWORKS],
    networkScans: Object.fromEntries(
      ALCHEMY_NETWORKS.map((network) => [
        network,
        { pagesFetched: 0, scanComplete: false },
      ]),
    ),
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

function isNativeTokenAddress(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value !== 'string') return false;

  const normalized = value.toLowerCase();
  return (
    normalized === '0x0000000000000000000000000000000000000000' ||
    normalized === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  );
}

function parseHolding(tokenUnknown: unknown, requestedAddress: string): AlchemyHolding | undefined {
  if (!isRecord(tokenUnknown)) return undefined;

  const tokenOwner = readNonEmptyString(tokenUnknown.address);
  if (tokenOwner && tokenOwner.toLowerCase() !== requestedAddress.toLowerCase()) return undefined;

  const network = readNonEmptyString(tokenUnknown.network);
  if (!network || !ALCHEMY_NETWORK_SET.has(network)) return undefined;

  const metadata = isRecord(tokenUnknown.tokenMetadata) ? tokenUnknown.tokenMetadata : {};
  if (isSpamToken(tokenUnknown, metadata)) return undefined;

  const rawTokenAddress = tokenUnknown.tokenAddress;
  const tokenAddress = isNativeTokenAddress(rawTokenAddress)
    ? null
    : typeof rawTokenAddress === 'string' && isEthereumAddress(rawTokenAddress)
      ? rawTokenAddress
      : undefined;
  if (tokenAddress === undefined) return undefined;

  // Alchemy documents native assets with a null token address, but native
  // metadata can omit decimals. Every configured chain uses 18 native
  // decimals, so keep those balances instead of silently dropping them.
  const decimals = readDecimals(metadata.decimals) ?? (tokenAddress === null ? 18 : undefined);
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

function parseEtherscanPage(value: unknown): unknown[] | undefined {
  if (!isRecord(value) || !Array.isArray(value.result)) return undefined;

  const status = readNonEmptyString(value.status);
  if (status === '1') return value.result;

  const message = readNonEmptyString(value.message)?.toLowerCase();
  if (
    status === '0' &&
    value.result.length === 0 &&
    (message?.includes('no records') || message?.includes('no transactions'))
  ) {
    return value.result;
  }

  return undefined;
}

function parseEtherscanHolding(
  value: unknown,
  network: AlchemyNetwork,
): AlchemyHolding | undefined {
  if (!isRecord(value)) return undefined;

  const tokenAddress = readNonEmptyString(value.TokenAddress);
  if (!tokenAddress || !isEthereumAddress(tokenAddress)) return undefined;

  const decimals = readDecimals(value.TokenDivisor);
  if (decimals === undefined) return undefined;

  const balance = formatAtomicBalance(value.TokenQuantity, decimals);
  if (!balance) return undefined;

  const numericBalance = Number(balance);
  const usdPrice = readPositiveNumber(value.TokenPriceUSD);
  if (!Number.isFinite(numericBalance) || numericBalance <= 0 || usdPrice === undefined) {
    return undefined;
  }

  const usdValue = numericBalance * usdPrice;
  if (!Number.isFinite(usdValue) || usdValue <= 0) return undefined;

  const symbol = readDisplayString(value.TokenSymbol, 'TOKEN');
  const name = readDisplayString(value.TokenName, symbol);

  return {
    network,
    tokenAddress,
    symbol,
    name,
    balance,
    usdPrice,
    usdValue,
  };
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
}

async function scanPortfolioPages(options: {
  fetchFn: typeof fetch;
  endpoint: string;
  body: UnknownRecord;
  deadline: number;
  maxPages: number;
  providerTimeoutMs: number;
  now: () => number;
  scope: string;
}): Promise<PortfolioScanResult> {
  const {
    fetchFn,
    endpoint,
    body,
    deadline,
    maxPages,
    providerTimeoutMs,
    now,
    scope,
  } = options;
  const tokens: unknown[] = [];
  const seenPageKeys = new Set<string>();
  let pageKey: string | undefined;
  let pagesFetched = 0;

  try {
    for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
      const remainingMs = deadline - now();
      if (remainingMs < MIN_REQUEST_TIMEOUT_MS) {
        return {
          tokens,
          pagesFetched,
          scanComplete: false,
          error: 'SCAN_DEADLINE',
        };
      }

      const response = await fetchFn(endpoint, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pageKey ? { ...body, pageKey } : body),
        cache: 'no-store',
        signal: AbortSignal.timeout(Math.min(providerTimeoutMs, remainingMs)),
      });

      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        console.error(JSON.stringify({
          event: 'alchemy_portfolio_http_error',
          scope,
          status: response.status,
        }));
        return {
          tokens,
          pagesFetched,
          scanComplete: false,
          error: 'API_ERROR',
        };
      }

      const responseBody: unknown = await response.json();
      const page = parsePortfolioPage(responseBody);
      if (!page) {
        console.error(JSON.stringify({
          event: 'alchemy_portfolio_invalid_response',
          scope,
        }));
        return {
          tokens,
          pagesFetched,
          scanComplete: false,
          error: 'INVALID_RESPONSE',
        };
      }

      pagesFetched += 1;
      tokens.push(...page.tokens);

      const nextPageKey = page.pageKey;
      if (!nextPageKey) {
        return {
          tokens,
          pagesFetched,
          scanComplete: true,
        };
      }

      if (seenPageKeys.has(nextPageKey)) {
        return {
          tokens,
          pagesFetched,
          scanComplete: false,
          error: 'REPEATED_PAGE_KEY',
        };
      }

      seenPageKeys.add(nextPageKey);
      pageKey = nextPageKey;
    }

    return {
      tokens,
      pagesFetched,
      scanComplete: false,
      error: 'PAGE_LIMIT',
    };
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    console.error(JSON.stringify({
      event: 'alchemy_portfolio_fetch_error',
      scope,
      errorName,
    }));
    return {
      tokens,
      pagesFetched,
      scanComplete: false,
      error: isTimeoutError(error) ? 'TIMEOUT' : 'FETCH_ERROR',
    };
  }
}

function createEmptyEtherscanNetworkScans(): EtherscanScanResult['networkScans'] {
  return Object.fromEntries(
    ALCHEMY_NETWORKS.map((network) => [
      network,
      { pagesFetched: 0, scanComplete: false },
    ]),
  ) as EtherscanScanResult['networkScans'];
}

async function scanEtherscanHoldings(options: {
  fetchFn: typeof fetch;
  apiKey: string;
  address: string;
  deadline: number;
  providerTimeoutMs: number;
  requestIntervalMs: number;
  now: () => number;
  sleepFn: (milliseconds: number) => Promise<void>;
}): Promise<EtherscanScanResult> {
  const {
    fetchFn,
    apiKey,
    address,
    deadline,
    providerTimeoutMs,
    requestIntervalMs,
    now,
    sleepFn,
  } = options;
  const holdings: AlchemyHolding[] = [];
  const networkScans = createEmptyEtherscanNetworkScans();
  let pagesFetched = 0;
  let lastRequestStartedAt: number | undefined;
  let firstError: EtherscanScanResult['error'];
  let deadlineReached = false;

  for (const network of ALCHEMY_NETWORKS) {
    const networkScan = networkScans[network];
    const { chainId, maxEtherscanPages } = NETWORK_CONFIG[network];

    for (let page = 1; page <= maxEtherscanPages; page += 1) {
      let remainingMs = deadline - now();
      if (remainingMs < MIN_REQUEST_TIMEOUT_MS) {
        firstError ??= 'SCAN_DEADLINE';
        deadlineReached = true;
        break;
      }

      if (lastRequestStartedAt !== undefined) {
        const elapsedMs = now() - lastRequestStartedAt;
        const waitMs = Math.max(0, requestIntervalMs - elapsedMs);
        if (waitMs > 0) await sleepFn(waitMs);
      }

      remainingMs = deadline - now();
      if (remainingMs < MIN_REQUEST_TIMEOUT_MS) {
        firstError ??= 'SCAN_DEADLINE';
        deadlineReached = true;
        break;
      }

      const endpoint = new URL('https://api.etherscan.io/v2/api');
      endpoint.searchParams.set('chainid', chainId);
      endpoint.searchParams.set('module', 'account');
      endpoint.searchParams.set('action', 'addresstokenbalance');
      endpoint.searchParams.set('address', address);
      endpoint.searchParams.set('page', String(page));
      endpoint.searchParams.set('offset', String(ETHERSCAN_PAGE_SIZE));
      endpoint.searchParams.set('apikey', apiKey);
      lastRequestStartedAt = now();

      try {
        const response = await fetchFn(endpoint, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          cache: 'no-store',
          signal: AbortSignal.timeout(Math.min(providerTimeoutMs, remainingMs)),
        });

        if (!response.ok) {
          await response.body?.cancel().catch(() => undefined);
          console.error(JSON.stringify({
            event: 'etherscan_holdings_http_error',
            network,
            status: response.status,
          }));
          firstError ??= 'API_ERROR';
          break;
        }

        const responseBody: unknown = await response.json();
        const rows = parseEtherscanPage(responseBody);
        if (!rows) {
          console.error(JSON.stringify({
            event: 'etherscan_holdings_invalid_response',
            network,
          }));
          firstError ??= 'INVALID_RESPONSE';
          break;
        }

        pagesFetched += 1;
        networkScan.pagesFetched += 1;
        for (const row of rows) {
          const holding = parseEtherscanHolding(row, network);
          if (holding) holdings.push(holding);
        }

        if (rows.length < ETHERSCAN_PAGE_SIZE) {
          networkScan.scanComplete = true;
          break;
        }
      } catch (error) {
        const errorName = error instanceof Error ? error.name : 'UnknownError';
        console.error(JSON.stringify({
          event: 'etherscan_holdings_fetch_error',
          network,
          errorName,
        }));
        firstError ??= isTimeoutError(error) ? 'TIMEOUT' : 'FETCH_ERROR';
        break;
      }
    }

    if (deadlineReached) break;
  }

  const incompleteNetworks = ALCHEMY_NETWORKS.filter(
    (network) => !networkScans[network].scanComplete,
  );

  return {
    holdings,
    pagesFetched,
    scanComplete: incompleteNetworks.length === 0,
    incompleteNetworks,
    networkScans,
    ...(firstError ? { error: firstError } : {}),
  };
}

const defaultDependencies = {
  ensClient,
  fetchFn: fetch,
  maxPagesPerNetwork: MAX_PAGES_PER_NETWORK,
  pageLimits: DEFAULT_PAGE_LIMITS,
  providerTimeoutMs: PROVIDER_TIMEOUT_MS,
  scanTimeoutMs: SCAN_TIMEOUT_MS,
  now: Date.now,
  sleepFn: (milliseconds: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
  etherscanRequestIntervalMs: ETHERSCAN_REQUEST_INTERVAL_MS,
  enforceInternalAccess: process.env.NODE_ENV === 'production',
};

export function createHandler(dependencies = defaultDependencies) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const {
      fetchFn,
      ensClient,
      maxPagesPerNetwork = MAX_PAGES_PER_NETWORK,
      pageLimits = DEFAULT_PAGE_LIMITS,
      providerTimeoutMs = PROVIDER_TIMEOUT_MS,
      scanTimeoutMs = SCAN_TIMEOUT_MS,
      now = Date.now,
      sleepFn = defaultDependencies.sleepFn,
      etherscanRequestIntervalMs = ETHERSCAN_REQUEST_INTERVAL_MS,
      enforceInternalAccess = defaultDependencies.enforceInternalAccess,
    } = dependencies;

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    if (enforceInternalAccess) {
      const expectedToken = readNonEmptyString(process.env.PROFILE_REFRESH_TOKEN);
      const rawHeader = req.headers[PROFILE_REFRESH_HEADER];
      const providedToken = readNonEmptyString(
        Array.isArray(rawHeader) ? rawHeader[0] : rawHeader,
      );
      if (!expectedToken || providedToken !== expectedToken) {
        return res.status(404).json({ error: 'Not Found' });
      }
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

    const alchemyApiKey = readNonEmptyString(process.env.ALCHEMY_API_KEY);
    const etherscanApiKey = readNonEmptyString(process.env.ETHERSCAN_API_KEY);
    if (!alchemyApiKey && !etherscanApiKey) {
      return res.status(200).json(emptyResult('NO_API_KEY'));
    }

    const endpoint = alchemyApiKey
      ? `https://api.g.alchemy.com/data/v1/${encodeURIComponent(alchemyApiKey)}` +
        '/assets/tokens/by-address'
      : undefined;
    const sharedBody = {
      withMetadata: true,
      withPrices: true,
    };

    try {
      const configuredMaxPages = Number.isFinite(maxPagesPerNetwork)
        ? Math.floor(maxPagesPerNetwork)
        : MAX_PAGES_PER_NETWORK;
      const boundedMaxPages = Math.max(
        1,
        Math.min(MAX_PAGES_PER_NETWORK, configuredMaxPages),
      );
      const configuredProviderTimeout = Number.isFinite(providerTimeoutMs)
        ? Math.floor(providerTimeoutMs)
        : PROVIDER_TIMEOUT_MS;
      const boundedProviderTimeout = Math.max(
        MIN_REQUEST_TIMEOUT_MS,
        Math.min(PROVIDER_TIMEOUT_MS, configuredProviderTimeout),
      );
      const configuredScanTimeout = Number.isFinite(scanTimeoutMs)
        ? Math.floor(scanTimeoutMs)
        : SCAN_TIMEOUT_MS;
      const boundedScanTimeout = Math.max(
        MIN_REQUEST_TIMEOUT_MS,
        Math.min(SCAN_TIMEOUT_MS, configuredScanTimeout),
      );
      const deadline = now() + boundedScanTimeout;

      const emptyAlchemyScans = (): PortfolioScanResult[] =>
        ALCHEMY_NETWORKS.map(() => ({
          tokens: [],
          pagesFetched: 0,
          scanComplete: false,
          error: 'FETCH_ERROR',
        }));
      const alchemyScansPromise = endpoint
        ? Promise.all(ALCHEMY_NETWORKS.map((network) =>
            scanPortfolioPages({
              fetchFn,
              endpoint,
              body: {
                ...sharedBody,
                addresses: [{
                  address: resolvedAddress,
                  networks: [network],
                }],
                // Alchemy's native-only Portfolio API request currently omits
                // native rows. Request both asset classes, read just the first
                // page, and discard its uncurated ERC-20 valuations below.
                includeNativeTokens: true,
                includeErc20Tokens: true,
              },
              deadline,
              maxPages: Math.max(
                1,
                Math.min(
                  boundedMaxPages,
                  Number.isFinite(pageLimits[network])
                    ? Math.floor(pageLimits[network])
                    : DEFAULT_PAGE_LIMITS[network],
                ),
              ),
              providerTimeoutMs: boundedProviderTimeout,
              now,
              scope: network,
            }),
          ))
        : Promise.resolve(emptyAlchemyScans());
      const etherscanScanPromise = etherscanApiKey
        ? scanEtherscanHoldings({
            fetchFn,
            apiKey: etherscanApiKey,
            address: resolvedAddress,
            deadline,
            providerTimeoutMs: boundedProviderTimeout,
            requestIntervalMs: Math.max(0, Math.floor(etherscanRequestIntervalMs)),
            now,
            sleepFn,
          })
        : Promise.resolve<EtherscanScanResult | undefined>(undefined);

      const [networkScans, etherscanScan] = await Promise.all([
        alchemyScansPromise,
        etherscanScanPromise,
      ]);
      const successfulAlchemyPageCount = networkScans.reduce(
        (sum, scan) => sum + scan.pagesFetched,
        0,
      );
      const hasUsableEtherscanScan = Boolean(etherscanScan && etherscanScan.pagesFetched > 0);
      if (successfulAlchemyPageCount === 0 && !hasUsableEtherscanScan) {
        const firstError =
          etherscanScan?.error ??
          networkScans.find((scan) => scan.error)?.error ??
          'FETCH_ERROR';
        return res.status(200).json(emptyResult(firstError));
      }

      const holdingsByAsset = new Map<string, AlchemyHolding>();
      for (const scan of networkScans) {
        for (const tokenUnknown of scan.tokens) {
          const holding = parseHolding(tokenUnknown, resolvedAddress);
          if (!holding || holding.tokenAddress !== null) continue;

          const assetKey = `${holding.network}:native`;
          const existing = holdingsByAsset.get(assetKey);
          if (!existing || holding.usdValue > existing.usdValue) {
            holdingsByAsset.set(assetKey, holding);
          }
        }
      }
      if (hasUsableEtherscanScan && etherscanScan) {
        for (const holding of etherscanScan.holdings) {
          const assetKey = `${holding.network}:${holding.tokenAddress?.toLowerCase()}`;
          const existing = holdingsByAsset.get(assetKey);
          if (!existing || holding.usdValue > existing.usdValue) {
            holdingsByAsset.set(assetKey, holding);
          }
        }
      }

      const holdings = [...holdingsByAsset.values()].sort((left, right) =>
        right.usdValue - left.usdValue ||
        left.symbol.localeCompare(right.symbol) ||
        left.network.localeCompare(right.network)
      );
      const totalValueUsd = holdings.reduce((sum, holding) => sum + holding.usdValue, 0);
      const nativeComplete = networkScans.every((scan) => scan.pagesFetched > 0);
      const networkScansByName = Object.fromEntries(
        ALCHEMY_NETWORKS.map((network, index) => [
          network,
          {
            pagesFetched:
              networkScans[index].pagesFetched +
              (etherscanScan?.networkScans[network].pagesFetched ?? 0),
            scanComplete:
              hasUsableEtherscanScan &&
              networkScans[index].pagesFetched > 0 &&
              etherscanScan?.networkScans[network].scanComplete === true,
            nativeFetched: networkScans[index].pagesFetched > 0,
            etherscanPagesFetched:
              etherscanScan?.networkScans[network].pagesFetched ?? 0,
          },
        ]),
      );
      const incompleteNetworks = new Set<string>();
      ALCHEMY_NETWORKS.forEach((network, index) => {
        if (
          !hasUsableEtherscanScan ||
          networkScans[index].pagesFetched === 0 ||
          etherscanScan?.networkScans[network].scanComplete !== true
        ) {
          incompleteNetworks.add(network);
        }
      });
      const scanComplete =
        hasUsableEtherscanScan &&
        nativeComplete &&
        etherscanScan?.scanComplete === true;
      const source: AlchemyResult['source'] = hasUsableEtherscanScan
        ? successfulAlchemyPageCount > 0
          ? 'etherscan+alchemy'
          : 'etherscan'
        : 'alchemy';
      const valueSemantics: AlchemyResult['valueSemantics'] = hasUsableEtherscanScan
        ? scanComplete
          ? 'priced-total'
          : 'priced-lower-bound'
        : 'native-only';
      const warning: AlchemyResult['warning'] | undefined = !etherscanApiKey
        ? 'ETHERSCAN_API_KEY_REQUIRED'
        : etherscanScan?.error || !hasUsableEtherscanScan
          ? 'ETHERSCAN_API_UNAVAILABLE'
          : undefined;
      const totalPagesFetched =
        successfulAlchemyPageCount + (etherscanScan?.pagesFetched ?? 0);

      return res.status(200).json({
        schemaVersion: ALCHEMY_SCHEMA_VERSION,
        totalValueUsd: Number.isFinite(totalValueUsd) ? totalValueUsd : 0,
        totalHoldings: holdings.length,
        topHoldings: holdings.slice(0, MAX_TOP_HOLDINGS),
        networks: [...ALCHEMY_NETWORKS],
        source,
        isPartial: !scanComplete,
        valueSemantics,
        scanComplete,
        nativeComplete,
        pagesFetched: totalPagesFetched,
        incompleteNetworks: [...incompleteNetworks],
        networkScans: networkScansByName,
        requiresEtherscanApiKey: !etherscanApiKey,
        ...(warning ? { warning } : {}),
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
