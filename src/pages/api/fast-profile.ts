import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import {
  globalFetchLock,
  addRecentUpdateEvent,
  FastProfileData, // Import FastProfileData from the shared store
  SERVICES_CONFIG,
} from '../../lib/cacheStore';




async function backgroundFetchRealData(address: string, originalInput?: string): Promise<void> {
  const normalizedAddress = address.toLowerCase();

  if (globalFetchLock.has(normalizedAddress)) {
    return;
  }

  addRecentUpdateEvent({ address: normalizedAddress, status: 'fetch_started' });
  const fetchPromise = (async () => {
    try {
      const servicePromises = SERVICES_CONFIG.map(async (service) => {
        try {
          // Use the current domain for server-side calls
          const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : process.env.NODE_ENV === 'production'
              ? 'https://crypto-me-thirdweb.vercel.app'  // fallback production URL
              : 'http://localhost:3000';

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
      });

      await Promise.allSettled(servicePromises);

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return res.status(200).json({ status: 'Fast Profile Handler Reached' });
  /*
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { address } = req.query;
  // ... rest of the code
  */
}