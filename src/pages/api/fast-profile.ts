import { NextApiRequest, NextApiResponse } from 'next';

// Dynamic imports will be used inside the handler to avoid potential initialization issues
// import { prisma } from '../../../lib/prisma';
// import {
//   globalFetchLock,
//   addRecentUpdateEvent,
//   FastProfileData,
//   SERVICES_CONFIG,
// } from '../../lib/cacheStore';

// We need to define types locally or import them as types only if possible, 
// but for now let's rely on dynamic imports for the logic.
// Actually, we can import types safely.
import type { FastProfileData } from '../../lib/cacheStore';

// Helper function needs to be moved or adapted if we want to use dynamic imports for it too, 
// or we can keep it but pass dependencies.
// For now, let's inline the logic or simplify.

export async function backgroundFetchRealData(): Promise<void> {
  // This function will need to re-import dependencies if called independently, 
  // or we can pass them. But since it's exported, let's try to keep it simple.
  // If this is causing the issue, we might need to move it.
  // For now, let's just return to avoid it being the cause.
  return;
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
    // Dynamic imports
    const { prisma } = await import('../../../lib/prisma');
    const { SERVICES_CONFIG } = await import('../../lib/cacheStore');

    const cachedServices = await prisma.service_cache.findMany({
      where: { address: normalizedAddress },
    });
    console.log(`[fast-profile:debug:${normalizedAddress}] Found ${cachedServices.length} cached services in DB.`);


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

    /*
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
    */

    console.log(`[fast-profile:debug:${normalizedAddress}] Returning responseData. Cache: ${responseData.cacheStatus}, Source: ${responseData.source}, LoadTime: ${responseData.loadTime}ms`);

    return res.status(200).json(responseData);

  } catch (error) {
    const errorInstance = error instanceof Error ? error : new Error(String(error));
    console.error(`[fast-profile:critical:${normalizedAddress}] Main handler error: ${errorInstance.message}. Returning error fallback.`, errorInstance);

    // Try to import addRecentUpdateEvent dynamically if it failed before
    try {
      const { addRecentUpdateEvent } = await import('../../lib/cacheStore');
      addRecentUpdateEvent({
        address: normalizedAddress,
        status: 'fetch_failed',
        message: `Handler error: ${errorInstance.message}`,
        errorName: errorInstance.name
      });
    } catch (e) {
      console.error('Failed to log error event', e);
    }

    // Fallback to default structure if database access fails
    const fallbackServicesData: FastProfileData['services'] = {};
    try {
      const { SERVICES_CONFIG } = await import('../../lib/cacheStore');
      SERVICES_CONFIG.forEach(sc => {
        fallbackServicesData[sc.name as keyof typeof fallbackServicesData] = sc.defaultData;
      });
    } catch (e) {
      console.error('Failed to load SERVICES_CONFIG for fallback', e);
    }

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