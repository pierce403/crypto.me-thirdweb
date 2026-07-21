import { Container, getContainer } from '@cloudflare/containers';

interface Env {
  XMTP_CONTAINER: DurableObjectNamespace<XmtpCollectorContainer>;
  COLLECTOR_TOKEN?: string;
}

const ETHEREUM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export class XmtpCollectorContainer extends Container {
  defaultPort = 8080;
  requiredPorts = [8080];
  pingEndpoint = '/healthz';
  sleepAfter = '10m';
  enableInternet = true;
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function tokensMatch(authorization: string | null, expected: string | undefined): Promise<boolean> {
  if (!authorization?.startsWith('Bearer ') || !expected) return false;
  const supplied = authorization.slice('Bearer '.length);
  const [suppliedDigest, expectedDigest] = await Promise.all([digest(supplied), digest(expected)]);
  let difference = 0;
  for (let index = 0; index < expectedDigest.length; index += 1) {
    difference |= suppliedDigest[index] ^ expectedDigest[index];
  }
  return difference === 0;
}

function json(status: number, payload: unknown): Response {
  return Response.json(payload, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/healthz') {
      return json(200, { status: 'ok' });
    }

    if (request.method !== 'GET' || url.pathname !== '/xmtp') {
      return json(404, { error: 'Not found' });
    }

    if (!(await tokensMatch(request.headers.get('authorization'), env.COLLECTOR_TOKEN))) {
      return json(401, { error: 'Unauthorized' });
    }

    const address = url.searchParams.get('address');
    if (!address || !ETHEREUM_ADDRESS_PATTERN.test(address)) {
      return json(400, { error: 'A valid Ethereum address is required' });
    }

    try {
      const container = getContainer(env.XMTP_CONTAINER, 'production');
      await container.startAndWaitForPorts({
        ports: 8080,
        cancellationOptions: {
          instanceGetTimeoutMS: 5_000,
          portReadyTimeoutMS: 12_000,
        },
        startOptions: { enableInternet: true },
      });

      const internalUrl = new URL('http://container/xmtp');
      internalUrl.searchParams.set('address', address);
      const response = await container.fetch(new Request(internalUrl, { method: 'GET' }));
      const headers = new Headers(response.headers);
      headers.set('cache-control', 'no-store');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.error(JSON.stringify({
        event: 'xmtp_container_request_failed',
        error: error instanceof Error ? error.message : 'unknown error',
      }));
      return json(502, {
        error: 'XMTP collector is temporarily unavailable',
        code: 'XMTP_CONTAINER_UNAVAILABLE',
      });
    }
  },
} satisfies ExportedHandler<Env>;
