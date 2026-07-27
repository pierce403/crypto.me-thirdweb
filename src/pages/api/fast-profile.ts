import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { PrismaClient } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPrisma, withPrisma } from '../../../lib/prisma';
import {
  type FastProfileData,
  SERVICES_CONFIG,
  type ServiceName,
} from '../../lib/cacheStore';
import { refreshProfileService, type ProfileRefreshMessage } from '../../lib/profileRefresh';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasUntrackedPayloadError(payload: unknown, errorCount: number | null): boolean {
  if ((errorCount ?? 0) > 0 || !isRecord(payload)) return false;
  const error = payload.error;
  return typeof error === 'string' && error.trim().length > 0;
}

async function scheduleRefreshes(
  req: NextApiRequest,
  prisma: PrismaClient,
  address: string,
  services: readonly ServiceName[],
): Promise<void> {
  const candidateServices = process.env.NODE_ENV === 'production' ? services : services.slice(0, 1);
  const candidateMessages: ProfileRefreshMessage[] = candidateServices.map((service) => ({
    address: address.toLowerCase(),
    originalInput: address,
    service,
  }));

  // The browser polls this endpoint and Queues deliver at least once. Claim a
  // short database lease before enqueueing so concurrent requests do not fan
  // out identical upstream work. Old claims become eligible again after a
  // failed/DLQ delivery and the one-hour service backoff has elapsed.
  const leaseCutoff = new Date(Date.now() - 15 * 60 * 1000);
  const now = new Date();
  const messages: ProfileRefreshMessage[] = [];
  for (const message of candidateMessages) {
    const key = { address: message.address, service: message.service };
    const recovered = await prisma.sync_queue.updateMany({
      where: {
        ...key,
        OR: [
          { last_attempt: { lt: leaseCutoff } },
          { last_attempt: null, created_at: { lt: leaseCutoff } },
        ],
      },
      data: {
        processing: true,
        attempts: 0,
        last_attempt: now,
        error: null,
        created_at: now,
      },
    });
    if (recovered.count > 0) {
      messages.push(message);
      continue;
    }

    const created = await prisma.sync_queue.createMany({
      data: [{ ...key, processing: true, last_attempt: now }],
      skipDuplicates: true,
    });
    if (created.count > 0) messages.push(message);
  }

  if (messages.length === 0) return;

  if (process.env.NODE_ENV === 'production') {
    try {
      const { env } = getCloudflareContext();
      await env.PROFILE_REFRESH_QUEUE.sendBatch(messages.map((body) => ({ body })));
      console.log(JSON.stringify({
        event: 'profile_refresh_enqueued',
        address: address.toLowerCase(),
        services,
      }));
      return;
    } catch (error) {
      const failure = error instanceof Error ? error.message : String(error);
      console.warn(JSON.stringify({
        event: 'profile_refresh_queue_unavailable',
        address: address.toLowerCase(),
        error: failure,
      }));
    }
  }

  // Keep `next dev` usable without a local Queue consumer. This bridge
  // intentionally handles only one service so it remains bounded.
  const fallbackService = messages[0];
  if (!fallbackService) return;
  if (messages.length > 1) {
    await prisma.sync_queue.deleteMany({
      where: {
        OR: messages.slice(1).map((message) => ({
          address: message.address,
          service: message.service,
        })),
      },
    });
  }
  const hostHeader = req.headers['x-forwarded-host'] ?? req.headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  if (!host) {
    await prisma.sync_queue.deleteMany({
      where: { address: fallbackService.address, service: fallbackService.service },
    });
    return;
  }
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const baseUrl = `${proto || 'http'}://${host}`;

  const refreshPromise = withPrisma(async (prisma) => {
    await refreshProfileService(prisma, fallbackService, fetch, baseUrl);
    await prisma.sync_queue.deleteMany({
      where: { address: fallbackService.address, service: fallbackService.service },
    });
  });

  try {
    getCloudflareContext().ctx.waitUntil(refreshPromise);
  } catch {
    void refreshPromise.catch((error) => {
      console.error(JSON.stringify({
        event: 'profile_refresh_fallback_failed',
        address: address.toLowerCase(),
        error: error instanceof Error ? error.message : String(error),
      }));
    });
  }
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

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: 'A valid Ethereum address is required' });
  }

  const normalizedAddress = address.toLowerCase();
  console.log(`[fast-profile:info] Handler invoked for address: ${normalizedAddress}`);

  let prisma: ReturnType<typeof getPrisma> | undefined;
  try {
    prisma = getPrisma();
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
        let parsedData: unknown = serviceConfig.defaultData;
        try {
          parsedData = JSON.parse(cachedEntry.data as string);
          if (parsedData !== null && !isRecord(parsedData)) {
            throw new Error('Cached service data must be a JSON object or null');
          }
          servicesData[serviceConfig.name as keyof typeof servicesData] = parsedData;
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
        if (
          hasUntrackedPayloadError(parsedData, cachedEntry.error_count ?? 0) ||
          !cachedEntry.expires_at ||
          new Date(cachedEntry.expires_at) < nowForFreshness
        ) {
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
      // Queue a small batch; subsequent client polls enqueue remaining stale
      // services without keeping this HTTP request alive.
      const MAX_SERVICES_PER_ENQUEUE = 3;
      await scheduleRefreshes(req, prisma, address, servicesNeedingRefresh.slice(0, MAX_SERVICES_PER_ENQUEUE));
    }

    console.log(`[fast-profile:debug:${normalizedAddress}] Returning responseData. Cache: ${responseData.cacheStatus}, Source: ${responseData.source}, LoadTime: ${responseData.loadTime}ms`);

    return res.status(200).json(responseData);

  } catch (error) {
    const errorInstance = error instanceof Error ? error : new Error(String(error));
    console.error(`[fast-profile:critical:${normalizedAddress}] Main handler error: ${errorInstance.message}. Returning error fallback.`, errorInstance);

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
  } finally {
    await prisma?.$disconnect();
  }
}
