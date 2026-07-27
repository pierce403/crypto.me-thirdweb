import type { PrismaClient } from '@prisma/client';
import { SERVICES_CONFIG, type ServiceName } from './cacheStore';

type ServiceCacheUpsertArgs = Parameters<PrismaClient['service_cache']['upsert']>[0];

export interface ProfileRefreshStore {
  service_cache: {
    upsert(args: ServiceCacheUpsertArgs): Promise<unknown>;
  };
}

export interface ProfileRefreshMessage {
  address: string;
  originalInput?: string;
  service: ServiceName;
}

export type ServiceRefreshResult = 'updated' | 'upstream-error' | 'configuration-error';

function errorFromPayload(payload: unknown): string | undefined {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return undefined;

  const candidate = payload as { error?: unknown; message?: unknown };
  if (typeof candidate.error === 'string' && candidate.error.trim()) return candidate.error;
  if (candidate.error !== undefined && candidate.error !== null) return JSON.stringify(candidate.error);
  if (typeof candidate.message === 'string' && candidate.message.trim()) return candidate.message;
  return undefined;
}

export async function refreshProfileService(
  prisma: ProfileRefreshStore,
  message: ProfileRefreshMessage,
  fetchService: typeof fetch,
  baseUrl: string,
): Promise<ServiceRefreshResult> {
  const normalizedAddress = message.address.toLowerCase();
  const service = SERVICES_CONFIG.find((candidate) => candidate.name === message.service);
  if (!service) throw new Error(`Unknown profile service: ${message.service}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), service.timeoutMs);

  try {
    const servicePath = service.url(message.address, message.originalInput);
    const response = await fetchService(new URL(servicePath, baseUrl), {
      signal: controller.signal,
      headers: { 'User-Agent': 'CryptoMe-ProfileRefresh/2.0' },
    });

    const now = new Date();
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = undefined;
    }
    const payloadError = errorFromPayload(data);

    if (response.ok && !payloadError && data !== undefined) {
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await prisma.service_cache.upsert({
        where: { address_service: { address: normalizedAddress, service: service.name } },
        update: {
          data: JSON.stringify(data),
          last_updated: now,
          expires_at: expiresAt,
          error_count: 0,
          last_error: null,
        },
        create: {
          address: normalizedAddress,
          service: service.name,
          data: JSON.stringify(data),
          last_updated: now,
          expires_at: expiresAt,
        },
      });

      console.log(JSON.stringify({
        event: 'profile_service_updated',
        address: normalizedAddress,
        service: service.name,
      }));
      return 'updated';
    }

    const upstreamError = payloadError ?? `Service returned ${response.status}`;
    let upstreamCode: string | undefined;
    if (data && typeof data === 'object') {
      const code = (data as { code?: unknown }).code;
      if (typeof code === 'string') upstreamCode = code;
    }

    const retryAt = new Date(now.getTime() + 60 * 60 * 1000);
    await prisma.service_cache.upsert({
      where: { address_service: { address: normalizedAddress, service: service.name } },
      update: {
        error_count: { increment: 1 },
        last_error: upstreamError,
        expires_at: retryAt,
        last_updated: now,
      },
      create: {
        address: normalizedAddress,
        service: service.name,
        data: JSON.stringify(service.defaultData),
        last_error: upstreamError,
        error_count: 1,
        expires_at: retryAt,
        last_updated: now,
      },
    });

    console.error(JSON.stringify({
      event: 'profile_service_failed',
      address: normalizedAddress,
      service: service.name,
      error: upstreamError,
    }));
    return upstreamCode === 'XMTP_COLLECTOR_UNAVAILABLE'
      ? 'configuration-error'
      : 'upstream-error';
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    const messageText = failure.name === 'AbortError'
      ? `Timeout fetching ${service.name} after ${service.timeoutMs}ms`
      : failure.message;
    const now = new Date();
    const retryAt = new Date(now.getTime() + 60 * 60 * 1000);

    await prisma.service_cache.upsert({
      where: { address_service: { address: normalizedAddress, service: service.name } },
      update: {
        error_count: { increment: 1 },
        last_error: messageText,
        expires_at: retryAt,
        last_updated: now,
      },
      create: {
        address: normalizedAddress,
        service: service.name,
        data: JSON.stringify(service.defaultData),
        last_error: messageText,
        error_count: 1,
        expires_at: retryAt,
        last_updated: now,
      },
    });

    console.error(JSON.stringify({
      event: 'profile_service_exception',
      address: normalizedAddress,
      service: service.name,
      error: messageText,
    }));
    return 'upstream-error';
  } finally {
    clearTimeout(timeoutId);
  }
}
