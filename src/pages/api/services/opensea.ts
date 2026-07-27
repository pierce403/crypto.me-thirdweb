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

const OPENSEA_PAGE_SIZE = 200;
const OPENSEA_MAX_PAGES = 3;
const OPENSEA_REQUEST_TIMEOUT_MS = 7000;
const TOP_NFT_LIMIT = 8;

// Helper function to check if a string is an ENS name
function isENSName(address: string): boolean {
  return address.toLowerCase().endsWith('.eth');
}

// Helper function to check if a string is an Ethereum address
function isEthereumAddress(input: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(input);
}

interface ValuedNFT {
  name: string;
  collection: string;
  image: string;
  floorPrice: number;
  lastSalePrice?: number;
  currency: string;
  permalink: string;
  rarity?: string;
  estimatedValue?: number;
  estimatedValueUsd?: number;
  estimatedValueSource: 'opensea_estimated_value_usd' | 'unavailable';
  valueLabel: 'OpenSea estimated value' | 'Estimate unavailable';
}

interface NormalizedNFT extends ValuedNFT {
  discoveryIndex: number;
}

interface MarketStats {
  totalEstimatedValue: number;
  totalFloorValue: number;
  uniqueCollections: number;
  totalNFTs: number;
  fetchedNFTs: number;
  valuedNFTs: number;
  unvaluedNFTs: number;
  excludedNFTs: number;
  pagesFetched: number;
  scanComplete: boolean;
  scanLimitReached: boolean;
  topCollectionsByValue: Array<{
    name: string;
    count: number;
    floorPrice: number;
    totalValue: number;
  }>;
}

interface OpenSeaResult {
  profileUrl: string;
  topValuedNFTs: ValuedNFT[];
  marketStats: MarketStats;
  portfolioSummary: {
    totalValue: number;
    currency: string;
    lastUpdated: string;
    valueSource: 'opensea_estimated_value_usd';
    isPartial: boolean;
  };
  source: string;
  error?: string;
  warning?: string;
}

interface OpenSeaDependencies {
  ensClient: Pick<typeof ensClient, 'getAddressRecord'>;
  fetchFn: typeof fetch;
  maxPages?: number;
  requestTimeoutMs?: number;
}

const defaultDependencies = {
  ensClient,
  fetchFn: fetch,
} satisfies OpenSeaDependencies;

function firstNonEmptyString(...candidates: unknown[]): string | undefined {
  return candidates.find(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0,
  );
}

function parseUsdEstimate(value: unknown): number | undefined {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : Number.NaN;

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function emptyResult(
  address: string,
  lastUpdated: string,
  error?: string,
): OpenSeaResult {
  return {
    profileUrl: `https://opensea.io/${address}`,
    topValuedNFTs: [],
    marketStats: {
      totalEstimatedValue: 0,
      totalFloorValue: 0,
      uniqueCollections: 0,
      totalNFTs: 0,
      fetchedNFTs: 0,
      valuedNFTs: 0,
      unvaluedNFTs: 0,
      excludedNFTs: 0,
      pagesFetched: 0,
      scanComplete: false,
      scanLimitReached: false,
      topCollectionsByValue: [],
    },
    portfolioSummary: {
      totalValue: 0,
      currency: 'USD',
      lastUpdated,
      valueSource: 'opensea_estimated_value_usd',
      isPartial: true,
    },
    source: 'none',
    ...(error ? { error } : {}),
  };
}

export function createHandler(dependencies: OpenSeaDependencies = defaultDependencies) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const {
      ensClient,
      fetchFn,
      maxPages = OPENSEA_MAX_PAGES,
      requestTimeoutMs = OPENSEA_REQUEST_TIMEOUT_MS,
    } = dependencies;

    async function fetchMarketDataFromOpenSea(address: string): Promise<OpenSeaResult> {
      const lastUpdated = new Date().toISOString();

      try {
        const openSeaApiKey = process.env.OPENSEA_API_KEY;

        if (!openSeaApiKey) {
          return emptyResult(address, lastUpdated, 'OPENSEA_API_KEY_REQUIRED');
        }

        const fetchedNFTs: UnknownRecord[] = [];
        const seenCursors = new Set<string>();
        let nextCursor: string | undefined;
        let pagesFetched = 0;
        let warning: string | undefined;

        const configuredMaxPages = Number.isFinite(maxPages)
          ? Math.floor(maxPages)
          : OPENSEA_MAX_PAGES;
        const boundedMaxPages = Math.max(1, Math.min(OPENSEA_MAX_PAGES, configuredMaxPages));
        const configuredTimeoutMs = Number.isFinite(requestTimeoutMs)
          ? Math.floor(requestTimeoutMs)
          : OPENSEA_REQUEST_TIMEOUT_MS;
        const boundedTimeoutMs = Math.max(
          1,
          Math.min(OPENSEA_REQUEST_TIMEOUT_MS, configuredTimeoutMs),
        );

        for (let page = 0; page < boundedMaxPages; page++) {
          const url = new URL(
            `https://api.opensea.io/api/v2/chain/ethereum/account/${address}/nfts`,
          );
          url.searchParams.set('limit', String(OPENSEA_PAGE_SIZE));
          if (nextCursor) url.searchParams.set('next', nextCursor);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), boundedTimeoutMs);

          try {
            const response = await fetchFn(url, {
              headers: {
                'x-api-key': openSeaApiKey,
                accept: 'application/json',
              },
              signal: controller.signal,
            });

            if (!response.ok) {
              console.error(JSON.stringify({
                event: 'opensea_api_error',
                status: response.status,
                page: page + 1,
              }));
              warning = pagesFetched > 0 ? 'PARTIAL_SERVICE_ERROR' : 'SERVICE_ERROR';
              break;
            }

            const data: unknown = await response.json();
            if (!isRecord(data) || !Array.isArray(data.nfts)) {
              warning = pagesFetched > 0 ? 'PARTIAL_INVALID_RESPONSE' : 'INVALID_RESPONSE';
              break;
            }

            fetchedNFTs.push(...data.nfts.filter(isRecord));
            pagesFetched++;

            const candidateCursor = firstNonEmptyString(data.next);
            if (!candidateCursor) {
              nextCursor = undefined;
              break;
            }

            if (seenCursors.has(candidateCursor)) {
              nextCursor = candidateCursor;
              warning = 'PAGINATION_CURSOR_REPEATED';
              break;
            }

            seenCursors.add(candidateCursor);
            nextCursor = candidateCursor;
          } catch (error) {
            console.error(JSON.stringify({
              event: 'opensea_request_failed',
              errorName: error instanceof Error ? error.name : 'UnknownError',
              page: page + 1,
            }));
            warning = pagesFetched > 0 ? 'PARTIAL_SERVICE_ERROR' : 'SERVICE_ERROR';
            break;
          } finally {
            clearTimeout(timeoutId);
          }
        }

        if (pagesFetched === 0 && warning) {
          return emptyResult(address, lastUpdated, warning);
        }

        const collectionStats: Record<string, { count: number; name: string; totalValue: number }> = {};
        const seenNFTs = new Set<string>();
        let excludedNFTs = 0;

        const normalizedNFTs = fetchedNFTs.flatMap<NormalizedNFT>((nftUnknown, discoveryIndex) => {
          // OpenSea's current Nft schema exposes these two public-safety flags.
          if (nftUnknown.is_disabled === true || nftUnknown.is_nsfw === true) {
            excludedNFTs++;
            return [];
          }

          const identifier = firstNonEmptyString(nftUnknown.identifier);
          const contract = firstNonEmptyString(nftUnknown.contract);
          const openseaUrl = firstNonEmptyString(nftUnknown.opensea_url);
          const identity = contract && identifier
            ? `${contract.toLowerCase()}:${identifier}`
            : openseaUrl;

          if (identity && seenNFTs.has(identity)) return [];
          if (identity) seenNFTs.add(identity);

          const collectionName = firstNonEmptyString(nftUnknown.collection) ?? 'Unknown Collection';

          if (!collectionStats[collectionName]) {
            collectionStats[collectionName] = { count: 0, name: collectionName, totalValue: 0 };
          }
          collectionStats[collectionName].count++;

          const image = firstNonEmptyString(
            nftUnknown.image_url,
            nftUnknown.display_image_url,
            nftUnknown.original_image_url,
          ) ?? '';
          // The OpenAPI schema declares a number; accepting a numeric string is
          // defensive against serialization drift without inventing other fields.
          const estimatedValueUsd = parseUsdEstimate(nftUnknown.estimated_value_usd);
          if (estimatedValueUsd !== undefined) {
            collectionStats[collectionName].totalValue += estimatedValueUsd;
          }

          const nftName = firstNonEmptyString(nftUnknown.name);
          const permalink = openseaUrl
            ?? (contract && identifier
              ? `https://opensea.io/assets/ethereum/${contract}/${identifier}`
              : `https://opensea.io/${address}`);

          return [{
            name: nftName ?? (identifier ? `#${identifier}` : 'NFT'),
            collection: collectionName,
            image,
            floorPrice: 0,
            currency: 'USD',
            permalink,
            rarity: undefined,
            ...(estimatedValueUsd !== undefined
              ? {
                  estimatedValue: estimatedValueUsd,
                  estimatedValueUsd,
                  estimatedValueSource: 'opensea_estimated_value_usd' as const,
                  valueLabel: 'OpenSea estimated value' as const,
                }
              : {
                  estimatedValueSource: 'unavailable' as const,
                  valueLabel: 'Estimate unavailable' as const,
                }),
            discoveryIndex,
          }];
        });

        const uniqueCollections = Object.keys(collectionStats).length;
        const topCollectionsByValue = Object.values(collectionStats)
          .sort((a, b) => b.totalValue - a.totalValue || b.count - a.count || a.name.localeCompare(b.name))
          .slice(0, TOP_NFT_LIMIT)
          .map((collection) => ({
            name: collection.name,
            count: collection.count,
            floorPrice: 0,
            totalValue: collection.totalValue,
          }));

        const sortedNFTs = normalizedNFTs.sort((a, b) => {
          const aHasEstimate = a.estimatedValueUsd !== undefined;
          const bHasEstimate = b.estimatedValueUsd !== undefined;
          if (aHasEstimate !== bHasEstimate) return aHasEstimate ? -1 : 1;
          if (aHasEstimate && bHasEstimate) {
            const valueDifference = (b.estimatedValueUsd ?? 0) - (a.estimatedValueUsd ?? 0);
            if (valueDifference !== 0) return valueDifference;
          }
          return a.discoveryIndex - b.discoveryIndex;
        });

        const totalEstimatedValue = normalizedNFTs.reduce(
          (sum, nft) => sum + (nft.estimatedValueUsd ?? 0),
          0,
        );
        const valuedNFTs = normalizedNFTs.filter((nft) => nft.estimatedValueUsd !== undefined).length;
        const scanComplete = nextCursor === undefined && warning === undefined;
        const scanLimitReached =
          warning === undefined &&
          nextCursor !== undefined &&
          pagesFetched === boundedMaxPages;

        return {
          profileUrl: `https://opensea.io/${address}`,
          topValuedNFTs: sortedNFTs.slice(0, TOP_NFT_LIMIT).map((nft) => {
            const publicNFT = { ...nft };
            delete (publicNFT as Partial<NormalizedNFT>).discoveryIndex;
            return publicNFT;
          }),
          marketStats: {
            totalEstimatedValue,
            totalFloorValue: 0,
            uniqueCollections,
            totalNFTs: normalizedNFTs.length,
            fetchedNFTs: fetchedNFTs.length,
            valuedNFTs,
            unvaluedNFTs: normalizedNFTs.length - valuedNFTs,
            excludedNFTs,
            pagesFetched,
            scanComplete,
            scanLimitReached,
            topCollectionsByValue,
          },
          portfolioSummary: {
            totalValue: totalEstimatedValue,
            currency: 'USD',
            lastUpdated,
            valueSource: 'opensea_estimated_value_usd',
            isPartial: !scanComplete,
          },
          source: 'opensea',
          ...(warning ? { warning } : {}),
        };
      } catch (error) {
        console.error(JSON.stringify({
          event: 'opensea_collector_failed',
          errorName: error instanceof Error ? error.name : 'UnknownError',
        }));
        return emptyResult(address, lastUpdated, 'SERVICE_ERROR');
      }
    }

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

    console.log(`Fetching OpenSea market data for: ${resolvedAddress}`);

    try {
      const result = await fetchMarketDataFromOpenSea(resolvedAddress);
      return res.status(200).json(result);
    } catch (error) {
      console.error('OpenSea service error:', error);

      return res.status(200).json(emptyResult(
        resolvedAddress,
        new Date().toISOString(),
        'SERVICE_ERROR',
      ));
    }
  };
}

export default createHandler(); 
