import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import {
  globalFetchLock,
  addRecentUpdateEvent,
  FastProfileData,
  SERVICES_CONFIG,
  ServiceName,
} from '../../lib/cacheStore';

function getBaseUrlForInternalRequests(baseUrlOverride?: string): string {
  if (baseUrlOverride) return baseUrlOverride;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NODE_ENV === 'production') return 'https://crypto-me-thirdweb.vercel.app'; // fallback production URL
  return 'http://localhost:3000';
}

function getBaseUrlFromRequest(req: NextApiRequest): string | null {
  const hostHeader = req.headers['x-forwarded-host'] ?? req.headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  if (!host) return null;

  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  return `${proto || 'http'}://${host}`;
}

async function runWithConcurrencyLimit<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;

  const runners = Array.from({ length: safeConcurrency }, async () => {
    while (true) {
      const idx = nextIndex;
      nextIndex += 1;
      if (idx >= items.length) return;
      await worker(items[idx]);
    }
  });

  await Promise.allSettled(runners);
}

export function backgroundFetchRealData(
  address: string,
  originalInput?: string,
  baseUrlOverride?: string,
  servicesToFetch?: readonly ServiceName[],
): Promise<void> {
  const normalizedAddress = address.toLowerCase();

  const existingPromise = globalFetchLock.get(normalizedAddress);
  if (existingPromise) return existingPromise;

  addRecentUpdateEvent({ address: normalizedAddress, status: 'fetch_started' });
  const baseUrl = getBaseUrlForInternalRequests(baseUrlOverride);
  const fetchPromise = (async () => {
    try {
      const selectedServices =
        servicesToFetch && servicesToFetch.length > 0
          ? SERVICES_CONFIG.filter((service) => servicesToFetch.includes(service.name))
          : SERVICES_CONFIG;

      await runWithConcurrencyLimit(selectedServices, 2, async (service) => {
        const serviceTimeoutMs = 10000;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), serviceTimeoutMs);

          const serviceUrl = service.url(address, originalInput);
          console.log(`[fast-profile:debug:${normalizedAddress}] Fetching service: ${service.name}, URL: ${baseUrl}${serviceUrl}`);
          const response = await (async () => {
            try {
              return await fetch(`${baseUrl}${serviceUrl}`, {
                signal: controller.signal,
                headers: { 'User-Agent': 'CryptoMe-FastProfile/1.0' }
              });
            } finally {
              clearTimeout(timeoutId);
            }
          })();

          const now = new Date();
          const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours expiry

          if (response.ok) {
            const data = await response.json();
            console.log(`[fast-profile:debug:${normalizedAddress}] Service ${service.name} OK. Data keys: ${Object.keys(data).join(', ')}`);

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
              update: { error_count: { increment: 1 }, last_error: serviceErrorMessage, expires_at: shortExpiry, last_updated: now },
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
        } catch (error) {
          const err = error instanceof Error ? error : new Error('Unknown fetch error');
          const isTimeout = err.name === 'AbortError';
          const message = isTimeout ? `Timeout fetching ${service.name} after ${serviceTimeoutMs}ms` : err.message;
          const errorName = isTimeout ? 'TimeoutError' : err.name;
          console.error(`[fast-profile:error:${normalizedAddress}] Service ${service.name} exception during fetch/processing: ${message}`, err);
          const now = new Date();
          const shortExpiry = new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1 hour expiry on error

          console.log(`[fast-profile:error:${normalizedAddress}] Service ${service.name} exception. Upserting error to DB with default data: ${JSON.stringify(service.defaultData)}, last_error: ${message}`);
          await prisma.service_cache.upsert({
            where: { address_service: { address: normalizedAddress, service: service.name } },
            update: { error_count: { increment: 1 }, last_error: message, expires_at: shortExpiry, last_updated: now },
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
      });

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
  return fetchPromise;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<FastProfileData | { error: string } | { status: string }>) {
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
    console.log(`[fast-profile:debug:${normalizedAddress}] Found ${cachedServices.length} cached services in DB.`);


    const servicesData: FastProfileData['services'] = {};
    const serviceErrors: { [serviceName: string]: { lastError: string; errorCount: number; lastAttempt: string } } = {};
    const serviceTimestamps: { [serviceName: string]: string } = {};
    let allServicesFresh = true;
    const servicesNeedingRefresh: ServiceName[] = [];
    let lastContentUpdate: Date | null = null;

    const nowForFreshness = new Date();
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

        // Include error information ONLY if there's a current error (error_count > 0)
        // When a service is successfully updated, error_count is set to 0 and last_error to null
        if (cachedEntry.error_count && cachedEntry.error_count > 0 && cachedEntry.last_error) {
          serviceErrors[serviceConfig.name] = {
            lastError: cachedEntry.last_error,
            errorCount: cachedEntry.error_count,
            lastAttempt: cachedEntry.last_updated?.toISOString() || new Date().toISOString()
          };
        }

        if (cachedEntry.last_updated && (!lastContentUpdate || cachedEntry.last_updated > lastContentUpdate)) {
          lastContentUpdate = cachedEntry.last_updated;
        }
        if (!cachedEntry.expires_at || new Date(cachedEntry.expires_at) < nowForFreshness) {
          allServicesFresh = false;
          servicesNeedingRefresh.push(serviceConfig.name);
        }
      } else {
        servicesData[serviceConfig.name as keyof typeof servicesData] = serviceConfig.defaultData;
        allServicesFresh = false;
        servicesNeedingRefresh.push(serviceConfig.name);
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
      // Limit background work per request to keep it reliable under serverless constraints.
      // On cache miss/partial, subsequent polls will pick up remaining services.
      const MAX_SERVICES_PER_BACKGROUND_RUN = 3;
      const servicesToFetch = servicesNeedingRefresh.slice(0, MAX_SERVICES_PER_BACKGROUND_RUN);

      const baseUrlFromReq = getBaseUrlFromRequest(req);
      const backgroundPromise = backgroundFetchRealData(normalizedAddress, address, baseUrlFromReq || undefined, servicesToFetch);
      const waitUntil = (res as unknown as { waitUntil?: (promise: Promise<unknown>) => void }).waitUntil;
      if (typeof waitUntil === 'function') {
        waitUntil(backgroundPromise);
      }
      backgroundPromise.catch(err => {
        const errorInstance = err instanceof Error ? err : new Error(String(err));
        addRecentUpdateEvent({
          address: normalizedAddress,
          status: 'fetch_failed',
          message: `Background fetch trigger error: ${errorInstance.message}`,
          errorName: errorInstance.name
        });
      });
    }

    console.log(`[fast-profile:debug:${normalizedAddress}] Returning responseData. Cache: ${responseData.cacheStatus}, Source: ${responseData.source}, LoadTime: ${responseData.loadTime}ms`);

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
