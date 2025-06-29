import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import {
  globalFetchLock,
  addRecentUpdateEvent,
  FastProfileData, // Import FastProfileData from the shared store
} from '../../lib/cacheStore';

const prisma = new PrismaClient();

const SERVICES_CONFIG = [
  { name: 'ens', defaultData: {}, url: (address: string) => `/api/services/ens?address=${address}` },
  { name: 'farcaster', defaultData: null, url: (address: string) => `/api/services/farcaster?address=${address}` },
  { name: 'alchemy', defaultData: { totalCount: 0, nfts: [], collections: {}, source: 'none' }, url: (address: string) => `/api/services/alchemy?address=${address}` },
  { name: 'opensea', defaultData: { profileUrl: '', topValuedNFTs: [], marketStats: { totalEstimatedValue: 0, totalFloorValue: 0, uniqueCollections: 0, totalNFTs: 0, topCollectionsByValue: [] }, portfolioSummary: { totalValue: 0, currency: 'ETH', lastUpdated: '' }, source: 'none' }, url: (address: string) => `/api/services/opensea?address=${address}` },
  { name: 'debank', defaultData: { totalUSD: 0, totalTokens: 0, totalProtocols: 0, topTokens: [], protocolPositions: [], portfolioUrl: '', lastUpdated: '', source: 'none' }, url: (address: string) => `/api/services/debank?address=${address}` },
  { name: 'icebreaker', defaultData: null, url: (address: string, originalInput?: string) => `/api/services/icebreaker?address=${originalInput || address}` },
  { name: 'gitcoin-passport', defaultData: {}, url: (address: string) => `/api/services/gitcoin-passport?address=${address}` },
  { name: 'decentraland', defaultData: {}, url: (address: string) => `/api/services/decentraland?address=${address}` },
];

async function backgroundFetchRealData(address: string, originalInput?: string): Promise<void> {
  const normalizedAddress = address.toLowerCase();
  
  if (globalFetchLock.has(normalizedAddress)) {
    return;
  }

  addRecentUpdateEvent({ address: normalizedAddress, status: 'fetch_started' });
  const fetchPromise = (async () => {
    try {
      for (const service of SERVICES_CONFIG) {
        try {
          const baseUrl =
            process.env.NEXT_PUBLIC_BASE_URL ||
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          
          const serviceUrl = service.url(address, originalInput);
          console.log(`[fast-profile:debug:${normalizedAddress}] Fetching service: ${service.name}, URL: ${baseUrl}${serviceUrl}`);
          const response = await fetch(`${baseUrl}${serviceUrl}`, {
            signal: controller.signal,
            headers: { 'User-Agent': 'CryptoMe-FastProfile/1.0' }
          });
          clearTimeout(timeoutId);
          
          const now = new Date();
          const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours expiry

          if (response.ok) {
            const data = await response.json();
            console.log(`[fast-profile:debug:${normalizedAddress}] Service ${service.name} OK. Raw data: ${JSON.stringify(data, null, 2)}`);
            const serviceDataJson = JSON.stringify(data);

            console.log(`[fast-profile:debug:${normalizedAddress}] Service ${service.name} OK. Upserting to DB: data length ${serviceDataJson.length}, expires_at: ${expiresAt.toISOString()}`);
            await prisma.service_cache.upsert({
              where: { address_service: { address: normalizedAddress, service: service.name } },
              update: { data: serviceDataJson, last_updated: now, expires_at: expiresAt, error_count: 0, last_error: null },
              create: { address: normalizedAddress, service: service.name, data: serviceDataJson, last_updated: now, expires_at: expiresAt },
            });
            addRecentUpdateEvent({ address: normalizedAddress, status: 'service_updated', serviceName: service.name });
          } else {
            let serviceErrorMessage = `Service returned ${response.status}`;
            const errorName = `HTTPError${response.status}`;
            console.log(`[fast-profile:error:${normalizedAddress}] Service ${service.name} failed. Status: ${response.status}, Message: ${serviceErrorMessage}`);
            try {
              const errorData = await response.json();
              if (errorData.error) {
                serviceErrorMessage = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
              } else if (typeof errorData === 'string') {
                serviceErrorMessage = errorData;
              } else if (errorData.message && typeof errorData.message === 'string') {
                serviceErrorMessage = errorData.message;
              }
            } catch {
              // Failed to parse error JSON
            }

            console.log(`[fast-profile:error:${normalizedAddress}] Service ${service.name} failed. Upserting error to DB with default data: ${JSON.stringify(service.defaultData)}, last_error: ${serviceErrorMessage}`);
            const shortExpiry = new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1 hour expiry on error
            await prisma.service_cache.upsert({
              where: { address_service: { address: normalizedAddress, service: service.name } },
              update: { error_count: { increment: 1 }, last_error: serviceErrorMessage, expires_at: shortExpiry },
              create: {
                address: normalizedAddress,
                service: service.name,
                data: JSON.stringify(service.defaultData),
                last_error: serviceErrorMessage,
                error_count: 1,
                expires_at: shortExpiry,
                last_updated: now
              },
            });
            addRecentUpdateEvent({ 
              address: normalizedAddress, 
              status: 'service_failed', 
              serviceName: service.name, 
              message: serviceErrorMessage,
              errorName: errorName
            });
          }
          if (SERVICES_CONFIG.indexOf(service) < SERVICES_CONFIG.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay between service calls
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error('Unknown fetch error');
          const message = err.message;
          const errorName = err.name === 'AbortError' ? 'TimeoutError' : err.name;
          console.error(`[fast-profile:error:${normalizedAddress}] Service ${service.name} exception during fetch/processing: ${err.message}`, err);
          const now = new Date();
          const shortExpiry = new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1 hour expiry on error

          console.log(`[fast-profile:error:${normalizedAddress}] Service ${service.name} exception. Upserting error to DB with default data: ${JSON.stringify(service.defaultData)}, last_error: ${message}`);
          await prisma.service_cache.upsert({
            where: { address_service: { address: normalizedAddress, service: service.name } },
            update: { error_count: { increment: 1 }, last_error: message, expires_at: shortExpiry },
            create: {
              address: normalizedAddress,
              service: service.name,
              data: JSON.stringify(service.defaultData),
              last_error: message,
              error_count: 1,
              expires_at: shortExpiry,
              last_updated: now
            },
          });
          addRecentUpdateEvent({ 
            address: normalizedAddress, 
            status: 'service_failed', 
            serviceName: service.name, 
            message,
            errorName
          });
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Outer background fetch error');
      addRecentUpdateEvent({ 
        address: normalizedAddress, 
        status: 'fetch_failed', 
        message: err.message,
        errorName: err.name 
      });
    } finally {
      globalFetchLock.delete(normalizedAddress);
      addRecentUpdateEvent({ address: normalizedAddress, status: 'fetch_completed' });
    }
  })();

  globalFetchLock.set(normalizedAddress, fetchPromise);
  // Do not await fetchPromise here to allow background execution
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<FastProfileData | { error: string }>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { address } = req.query;
  const startTime = Date.now();

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Address is required' });
  }

  const normalizedAddress = address.toLowerCase();
  console.log(`[fast-profile:info] Handler invoked for address: ${normalizedAddress}`);

  try {
    const cachedServices = await prisma.service_cache.findMany({
      where: { address: normalizedAddress },
    });
    console.log(`[fast-profile:debug:${normalizedAddress}] Found in DB cache: ${JSON.stringify(cachedServices, null, 2)}`);

    const servicesData: FastProfileData['services'] = {};
    const serviceErrors: { [serviceName: string]: { lastError: string; errorCount: number; lastAttempt: string } } = {};
    const serviceTimestamps: { [serviceName: string]: string } = {};
    let allServicesFresh = true;
    let lastContentUpdate: Date | null = null;

    for (const serviceConfig of SERVICES_CONFIG) {
      const cachedEntry = cachedServices.find(cs => cs.service === serviceConfig.name);
      if (cachedEntry) {
        try {
          servicesData[serviceConfig.name as keyof typeof servicesData] = JSON.parse(cachedEntry.data as string);
        } catch (e) {
          console.error(`[fast-profile:error] Failed to parse JSON for ${serviceConfig.name} for address ${normalizedAddress}:`, e);
          servicesData[serviceConfig.name as keyof typeof servicesData] = serviceConfig.defaultData;
          // Potentially mark this specific service as stale or log an error to be surfaced
        }

        // Include service timestamp
        if (cachedEntry.last_updated) {
          serviceTimestamps[serviceConfig.name] = cachedEntry.last_updated.toISOString();
        }

        // Include error information if present
        if (cachedEntry.last_error && cachedEntry.error_count && cachedEntry.error_count > 0) {
          serviceErrors[serviceConfig.name] = {
            lastError: cachedEntry.last_error,
            errorCount: cachedEntry.error_count,
            lastAttempt: cachedEntry.last_updated?.toISOString() || new Date().toISOString()
          };
        }

        if (cachedEntry.last_updated && (!lastContentUpdate || cachedEntry.last_updated > lastContentUpdate)) {
          lastContentUpdate = cachedEntry.last_updated;
        }
        if (!cachedEntry.expires_at || new Date(cachedEntry.expires_at) < new Date()) {
          allServicesFresh = false;
        }
      } else {
        servicesData[serviceConfig.name as keyof typeof servicesData] = serviceConfig.defaultData;
        allServicesFresh = false;
      }
    }

    const cacheStatus = allServicesFresh ? 'hit' : (cachedServices.length > 0 ? 'partial' : 'miss');
    const source = allServicesFresh ? 'database-cache' : (cachedServices.length > 0 ? 'database-partial-cache' : 'initial');
    
    const responseData: FastProfileData = {
      address: normalizedAddress,
      services: servicesData,
      serviceErrors: Object.keys(serviceErrors).length > 0 ? serviceErrors : undefined,
      serviceTimestamps: Object.keys(serviceTimestamps).length > 0 ? serviceTimestamps : undefined,
      lastContentUpdate: lastContentUpdate?.toISOString() || new Date(0).toISOString(), // Use epoch if no updates yet
      cacheStatus,
      source,
      loadTime: Date.now() - startTime,
    };

    if (!allServicesFresh) {
      backgroundFetchRealData(normalizedAddress, address).catch(err => {
        const errorInstance = err instanceof Error ? err : new Error(String(err));
        addRecentUpdateEvent({
          address: normalizedAddress,
          status: 'fetch_failed',
          message: `Background fetch trigger error: ${errorInstance.message}`,
          errorName: errorInstance.name
        });
      });
    }

    console.log(`[fast-profile:debug:${normalizedAddress}] Returning responseData: ${JSON.stringify(responseData, null, 2)}`);
    return res.status(200).json(responseData);

  } catch (error) {
    const errorInstance = error instanceof Error ? error : new Error(String(error));
    console.error(`[fast-profile:critical:${normalizedAddress}] Main handler error: ${errorInstance.message}. Returning error fallback.`, errorInstance);
    addRecentUpdateEvent({ 
      address: normalizedAddress, 
      status: 'fetch_failed', 
      message: `Handler error: ${errorInstance.message}`,
      errorName: errorInstance.name
    });

    // Fallback to default structure if database access fails
    const fallbackServicesData: FastProfileData['services'] = {};
    SERVICES_CONFIG.forEach(sc => {
        fallbackServicesData[sc.name as keyof typeof fallbackServicesData] = sc.defaultData;
    });

    const errorResponseData = {
      address: normalizedAddress,
      services: fallbackServicesData,
      lastContentUpdate: new Date(0).toISOString(),
      cacheStatus: 'miss',
      source: 'error-fallback',
      loadTime: Date.now() - startTime,
      error: `Failed to retrieve profile: ${errorInstance.message}`,
    };
    console.log(`[fast-profile:debug:${normalizedAddress}] Error fallback responseData: ${JSON.stringify(errorResponseData, null, 2)}`);

    return res.status(500).json(errorResponseData);
  }
}