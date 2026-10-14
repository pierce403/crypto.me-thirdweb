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

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

const OPENSEA_PAGE_SIZE = 200;
const OPENSEA_MAX_PAGES = 3;
const OPENSEA_REQUEST_TIMEOUT_MS = 7000;
const ALCHEMY_NFT_PAGE_SIZE = 100;
const ALCHEMY_NFT_MAX_PAGES = 3;
const ALCHEMY_NFT_REQUEST_TIMEOUT_MS = 3000;
const ALCHEMY_PRICE_REQUEST_TIMEOUT_MS = 2500;
const TOP_NFT_LIMIT = 8;

// Helper function to check if a string is an ENS name
function isENSName(address: string): boolean {
  return address.toLowerCase().endsWith('.eth');
}

// Helper function to check if a string is an Ethereum address
function isEthereumAddress(input: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(input);
}

type ValuationSource =
  | 'opensea_estimated_value_usd'
  | 'alchemy_opensea_collection_floor'
  | 'unavailable';

type PortfolioValueSource =
  | 'opensea_estimated_value_usd'
  | 'mixed_direct_and_collection_floor'
  | 'alchemy_opensea_collection_floor'
  | 'unavailable';

type ValuationStatus = 'available' | 'partial' | 'unavailable';

interface ProfileNFT {
  name: string;
  collection: string;
  image: string;
  floorPrice: number;
  floorPriceEth?: number;
  floorPriceCurrency?: 'ETH';
  lastSalePrice?: number;
  currency: string;
  permalink: string;
  rarity?: string;
  estimatedValue?: number;
  estimatedValueUsd?: number;
  valuationSource: ValuationSource;
  // Kept for cached clients that still read the pre-v2 field.
  estimatedValueSource: ValuationSource;
  valueLabel: 'OpenSea item estimate' | 'Collection floor proxy' | 'Valuation unavailable';
}

interface NormalizedNFT extends ProfileNFT {
  discoveryIndex: number;
}

interface MarketStats {
  totalEstimatedValue: number;
  totalFloorValue: number;
  uniqueCollections: number;
  totalNFTs: number;
  fetchedNFTs: number;
  valuedNFTs: number;
  directValuedNFTs: number;
  floorValuedNFTs: number;
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
  schemaVersion: 2;
  profileUrl: string;
  topValuedNFTs: ProfileNFT[];
  nftPreview: ProfileNFT[];
  valuationStatus: ValuationStatus;
  marketStats: MarketStats;
  portfolioSummary: {
    totalValue: number;
    currency: string;
    lastUpdated: string;
    valueSource: PortfolioValueSource;
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
  maxAlchemyPages?: number;
  alchemyRequestTimeoutMs?: number;
  alchemyPriceTimeoutMs?: number;
}

interface AlchemyFloorData {
  floorEthByCollection: Map<string, number>;
  ethUsd?: number;
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

function parsePositiveNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : Number.NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function fetchWithTimeout(
  fetchFn: typeof fetch,
  input: URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchFn(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function alchemyCollectionKey(contract: string, collectionSlug: string): string {
  return `${contract.toLowerCase()}:${collectionSlug.toLowerCase()}`;
}

function floorFromAlchemyOwnedNFT(
  value: unknown,
): { collectionKey: string; floorEth: number } | undefined {
  if (!isRecord(value) || !isRecord(value.contract)) return undefined;

  const contract = firstNonEmptyString(value.contract.address);
  if (!contract || !isEthereumAddress(contract)) return undefined;
  if (value.contract.isSpam === true) return undefined;
  if (!isRecord(value.collection)) return undefined;

  const collectionSlug = firstNonEmptyString(value.collection.slug);
  if (!collectionSlug) return undefined;

  const openSeaMetadata = isRecord(value.contract.openSeaMetadata)
    ? value.contract.openSeaMetadata
    : isRecord(value.contract.openseaMetadata)
      ? value.contract.openseaMetadata
      : undefined;
  if (!openSeaMetadata) return undefined;

  const floorEth = parsePositiveNumber(openSeaMetadata.floorPrice);
  if (floorEth === undefined) return undefined;

  return {
    collectionKey: alchemyCollectionKey(contract, collectionSlug),
    floorEth,
  };
}

async function fetchAlchemyFloorMap(
  fetchFn: typeof fetch,
  address: string,
  apiKey: string,
  maxPages: number,
  requestTimeoutMs: number,
): Promise<Map<string, number>> {
  const floorEthByCollection = new Map<string, number>();
  const seenPageKeys = new Set<string>();
  let pageKey: string | undefined;

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const url = new URL(
      `https://eth-mainnet.g.alchemy.com/nft/v3/${encodeURIComponent(apiKey)}/getNFTsForOwner`,
    );
    url.searchParams.set('owner', address);
    url.searchParams.set('withMetadata', 'true');
    url.searchParams.set('pageSize', String(ALCHEMY_NFT_PAGE_SIZE));
    // Collection metadata, including OpenSea floor price, comes from Alchemy's
    // cache. Avoid waiting on arbitrary token metadata origins.
    url.searchParams.set('tokenUriTimeoutInMs', '0');
    if (pageKey) url.searchParams.set('pageKey', pageKey);

    try {
      const response = await fetchWithTimeout(fetchFn, url, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      }, requestTimeoutMs);

      if (!response.ok) {
        console.error(JSON.stringify({
          event: 'opensea_alchemy_nft_http_error',
          status: response.status,
          page: pageIndex + 1,
        }));
        break;
      }

      const data: unknown = await response.json();
      if (!isRecord(data) || !Array.isArray(data.ownedNfts)) {
        console.error(JSON.stringify({
          event: 'opensea_alchemy_nft_invalid_response',
          page: pageIndex + 1,
        }));
        break;
      }

      for (const ownedNFT of data.ownedNfts) {
        const floor = floorFromAlchemyOwnedNFT(ownedNFT);
        if (!floor) continue;

        const existingFloor = floorEthByCollection.get(floor.collectionKey);
        if (existingFloor === undefined || floor.floorEth < existingFloor) {
          floorEthByCollection.set(floor.collectionKey, floor.floorEth);
        }
      }

      const candidatePageKey = firstNonEmptyString(data.pageKey);
      if (!candidatePageKey || seenPageKeys.has(candidatePageKey)) break;
      seenPageKeys.add(candidatePageKey);
      pageKey = candidatePageKey;
    } catch (error) {
      console.error(JSON.stringify({
        event: 'opensea_alchemy_nft_request_failed',
        errorName: error instanceof Error ? error.name : 'UnknownError',
        page: pageIndex + 1,
      }));
      break;
    }
  }

  return floorEthByCollection;
}

async function fetchAlchemyEthUsd(
  fetchFn: typeof fetch,
  apiKey: string,
  requestTimeoutMs: number,
): Promise<number | undefined> {
  const url = new URL(
    `https://api.g.alchemy.com/prices/v1/${encodeURIComponent(apiKey)}/tokens/by-symbol`,
  );
  url.searchParams.set('symbols', 'ETH');

  try {
    const response = await fetchWithTimeout(fetchFn, url, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    }, requestTimeoutMs);

    if (!response.ok) {
      console.error(JSON.stringify({
        event: 'opensea_alchemy_price_http_error',
        status: response.status,
      }));
      return undefined;
    }

    const data: unknown = await response.json();
    if (!isRecord(data) || !Array.isArray(data.data)) return undefined;

    for (const tokenUnknown of data.data) {
      if (!isRecord(tokenUnknown)) continue;
      if (firstNonEmptyString(tokenUnknown.symbol)?.toUpperCase() !== 'ETH') continue;
      if (!Array.isArray(tokenUnknown.prices)) continue;

      for (const priceUnknown of tokenUnknown.prices) {
        if (!isRecord(priceUnknown)) continue;
        if (firstNonEmptyString(priceUnknown.currency)?.toUpperCase() !== 'USD') continue;

        const ethUsd = parsePositiveNumber(priceUnknown.value);
        if (ethUsd !== undefined) return ethUsd;
      }
    }
  } catch (error) {
    console.error(JSON.stringify({
      event: 'opensea_alchemy_price_request_failed',
      errorName: error instanceof Error ? error.name : 'UnknownError',
    }));
  }

  return undefined;
}

async function fetchAlchemyFloorData(
  fetchFn: typeof fetch,
  address: string,
  apiKey: string,
  maxPages: number,
  nftRequestTimeoutMs: number,
  priceRequestTimeoutMs: number,
): Promise<AlchemyFloorData> {
  const [floorEthByCollection, ethUsd] = await Promise.all([
    fetchAlchemyFloorMap(fetchFn, address, apiKey, maxPages, nftRequestTimeoutMs),
    fetchAlchemyEthUsd(fetchFn, apiKey, priceRequestTimeoutMs),
  ]);

  return {
    floorEthByCollection,
    ...(ethUsd !== undefined ? { ethUsd } : {}),
  };
}

function emptyResult(
  address: string,
  lastUpdated: string,
  error?: string,
): OpenSeaResult {
  return {
    schemaVersion: 2,
    profileUrl: `https://opensea.io/${address}`,
    topValuedNFTs: [],
    nftPreview: [],
    valuationStatus: 'unavailable',
    marketStats: {
      totalEstimatedValue: 0,
      totalFloorValue: 0,
      uniqueCollections: 0,
      totalNFTs: 0,
      fetchedNFTs: 0,
      valuedNFTs: 0,
      directValuedNFTs: 0,
      floorValuedNFTs: 0,
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
      valueSource: 'unavailable',
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
      maxAlchemyPages = ALCHEMY_NFT_MAX_PAGES,
      alchemyRequestTimeoutMs = ALCHEMY_NFT_REQUEST_TIMEOUT_MS,
      alchemyPriceTimeoutMs = ALCHEMY_PRICE_REQUEST_TIMEOUT_MS,
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
        let alchemyFloorDataPromise: Promise<AlchemyFloorData> | undefined;

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
        const configuredMaxAlchemyPages = Number.isFinite(maxAlchemyPages)
          ? Math.floor(maxAlchemyPages)
          : ALCHEMY_NFT_MAX_PAGES;
        const boundedMaxAlchemyPages = Math.max(
          1,
          Math.min(ALCHEMY_NFT_MAX_PAGES, configuredMaxAlchemyPages),
        );
        const configuredAlchemyTimeoutMs = Number.isFinite(alchemyRequestTimeoutMs)
          ? Math.floor(alchemyRequestTimeoutMs)
          : ALCHEMY_NFT_REQUEST_TIMEOUT_MS;
        const boundedAlchemyTimeoutMs = Math.max(
          1,
          Math.min(ALCHEMY_NFT_REQUEST_TIMEOUT_MS, configuredAlchemyTimeoutMs),
        );
        const configuredAlchemyPriceTimeoutMs = Number.isFinite(alchemyPriceTimeoutMs)
          ? Math.floor(alchemyPriceTimeoutMs)
          : ALCHEMY_PRICE_REQUEST_TIMEOUT_MS;
        const boundedAlchemyPriceTimeoutMs = Math.max(
          1,
          Math.min(ALCHEMY_PRICE_REQUEST_TIMEOUT_MS, configuredAlchemyPriceTimeoutMs),
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
            const pageNeedsFallback = data.nfts.some(
              (nftUnknown) =>
                isRecord(nftUnknown) &&
                parsePositiveNumber(nftUnknown.estimated_value_usd) === undefined,
            );
            const alchemyApiKey = process.env.ALCHEMY_API_KEY;
            if (
              !alchemyFloorDataPromise &&
              alchemyApiKey &&
              (pageNeedsFallback || candidateCursor)
            ) {
              // Start the fallback beside the remaining cursor fetches so the
              // collector remains inside its outer 25-second service budget.
              alchemyFloorDataPromise = fetchAlchemyFloorData(
                fetchFn,
                address,
                alchemyApiKey,
                boundedMaxAlchemyPages,
                boundedAlchemyTimeoutMs,
                boundedAlchemyPriceTimeoutMs,
              );
            }

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

        let alchemyFloorData: AlchemyFloorData = {
          floorEthByCollection: new Map<string, number>(),
        };
        if (alchemyFloorDataPromise) {
          try {
            alchemyFloorData = await alchemyFloorDataPromise;
          } catch (error) {
            // OpenSea remains the source of truth for inventory. A valuation
            // fallback failure must not discard a successful inventory page.
            console.error(JSON.stringify({
              event: 'opensea_alchemy_fallback_failed',
              errorName: error instanceof Error ? error.name : 'UnknownError',
            }));
          }
        }

        const collectionStats: Record<
          string,
          { count: number; name: string; floorPrice: number; totalValue: number }
        > = {};
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
            collectionStats[collectionName] = {
              count: 0,
              name: collectionName,
              floorPrice: 0,
              totalValue: 0,
            };
          }
          collectionStats[collectionName].count++;

          const image = firstNonEmptyString(
            nftUnknown.image_url,
            nftUnknown.display_image_url,
            nftUnknown.original_image_url,
          ) ?? '';
          // The OpenAPI schema declares a number; accepting a numeric string is
          // defensive against serialization drift without inventing other fields.
          const directEstimateUsd = parsePositiveNumber(nftUnknown.estimated_value_usd);
          const normalizedContract = contract && isEthereumAddress(contract)
            ? contract.toLowerCase()
            : undefined;
          const floorPriceEth = normalizedContract
            ? alchemyFloorData.floorEthByCollection.get(
                alchemyCollectionKey(normalizedContract, collectionName),
              )
            : undefined;
          const floorEstimateUsd =
            floorPriceEth !== undefined && alchemyFloorData.ethUsd !== undefined
              ? floorPriceEth * alchemyFloorData.ethUsd
              : undefined;

          let estimatedValueUsd: number | undefined;
          let valuationSource: ValuationSource = 'unavailable';
          let valueLabel: ProfileNFT['valueLabel'] = 'Valuation unavailable';

          if (directEstimateUsd !== undefined) {
            estimatedValueUsd = directEstimateUsd;
            valuationSource = 'opensea_estimated_value_usd';
            valueLabel = 'OpenSea item estimate';
          } else if (
            floorEstimateUsd !== undefined &&
            Number.isFinite(floorEstimateUsd) &&
            floorEstimateUsd > 0
          ) {
            estimatedValueUsd = floorEstimateUsd;
            valuationSource = 'alchemy_opensea_collection_floor';
            valueLabel = 'Collection floor proxy';
          }

          if (floorPriceEth !== undefined) {
            const existingCollectionFloor = collectionStats[collectionName].floorPrice;
            collectionStats[collectionName].floorPrice =
              existingCollectionFloor > 0
                ? Math.min(existingCollectionFloor, floorPriceEth)
                : floorPriceEth;
          }
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
            floorPrice: floorPriceEth ?? 0,
            ...(floorPriceEth !== undefined
              ? { floorPriceEth, floorPriceCurrency: 'ETH' as const }
              : {}),
            currency: 'USD',
            permalink,
            rarity: undefined,
            ...(estimatedValueUsd !== undefined
              ? {
                  estimatedValue: estimatedValueUsd,
                  estimatedValueUsd,
                  valuationSource,
                  estimatedValueSource: valuationSource,
                  valueLabel,
                }
              : {
                  valuationSource: 'unavailable' as const,
                  estimatedValueSource: 'unavailable' as const,
                  valueLabel: 'Valuation unavailable' as const,
                }),
            discoveryIndex,
          }];
        });

        const uniqueCollections = Object.keys(collectionStats).length;
        const topCollectionsByValue = Object.values(collectionStats)
          .filter((collection) => collection.totalValue > 0)
          .sort((a, b) => b.totalValue - a.totalValue || b.count - a.count || a.name.localeCompare(b.name))
          .slice(0, TOP_NFT_LIMIT)
          .map((collection) => ({
            name: collection.name,
            count: collection.count,
            floorPrice: collection.floorPrice,
            totalValue: collection.totalValue,
          }));

        const valued = normalizedNFTs
          .filter((nft) => nft.estimatedValueUsd !== undefined)
          .sort((a, b) => {
            const valueDifference = (b.estimatedValueUsd ?? 0) - (a.estimatedValueUsd ?? 0);
            return valueDifference || a.discoveryIndex - b.discoveryIndex;
          });
        const unvalued = normalizedNFTs.filter((nft) => nft.estimatedValueUsd === undefined);

        const totalEstimatedValue = normalizedNFTs.reduce(
          (sum, nft) => sum + (nft.estimatedValueUsd ?? 0),
          0,
        );
        const totalFloorValue = normalizedNFTs.reduce(
          (sum, nft) =>
            sum +
            (nft.valuationSource === 'alchemy_opensea_collection_floor'
              ? nft.estimatedValueUsd ?? 0
              : 0),
          0,
        );
        const directValuedNFTs = normalizedNFTs.filter(
          (nft) => nft.valuationSource === 'opensea_estimated_value_usd',
        ).length;
        const floorValuedNFTs = normalizedNFTs.filter(
          (nft) => nft.valuationSource === 'alchemy_opensea_collection_floor',
        ).length;
        const valuedNFTs = valued.length;
        const scanComplete = nextCursor === undefined && warning === undefined;
        const scanLimitReached =
          warning === undefined &&
          nextCursor !== undefined &&
          pagesFetched === boundedMaxPages;
        const valuationStatus: ValuationStatus =
          valuedNFTs === 0
            ? 'unavailable'
            : valuedNFTs === normalizedNFTs.length && scanComplete
              ? 'available'
              : 'partial';
        const portfolioValueSource: PortfolioValueSource =
          directValuedNFTs > 0 && floorValuedNFTs > 0
            ? 'mixed_direct_and_collection_floor'
            : directValuedNFTs > 0
              ? 'opensea_estimated_value_usd'
              : floorValuedNFTs > 0
                ? 'alchemy_opensea_collection_floor'
                : 'unavailable';

        const toPublicNFT = (nft: NormalizedNFT): ProfileNFT => {
          const publicNFT = { ...nft };
          delete (publicNFT as Partial<NormalizedNFT>).discoveryIndex;
          return publicNFT;
        };

        return {
          schemaVersion: 2,
          profileUrl: `https://opensea.io/${address}`,
          topValuedNFTs: valued.slice(0, TOP_NFT_LIMIT).map(toPublicNFT),
          nftPreview: unvalued.slice(0, TOP_NFT_LIMIT).map(toPublicNFT),
          valuationStatus,
          marketStats: {
            totalEstimatedValue,
            totalFloorValue,
            uniqueCollections,
            totalNFTs: normalizedNFTs.length,
            fetchedNFTs: fetchedNFTs.length,
            valuedNFTs,
            directValuedNFTs,
            floorValuedNFTs,
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
            valueSource: portfolioValueSource,
            isPartial: valuationStatus !== 'available',
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
