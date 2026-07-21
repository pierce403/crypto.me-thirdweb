import { createServer } from 'node:http';
import {
  Client,
  IdentifierKind,
  createBackend,
  getInboxIdForIdentifier,
} from '@xmtp/node-sdk';
import { createRetryableResource, withTimeout } from './async.mjs';
import { collectXmtpProfile, isEthereumAddress } from './profile.mjs';

const port = Number.parseInt(process.env.PORT || '8080', 10);
const env = process.env.XMTP_ENV || 'production';
const gatewayHost = process.env.XMTP_GATEWAY_HOST || undefined;
const lookupTimeoutMs = 15_000;

const backend = createRetryableResource(() =>
  createBackend({
    env,
    gatewayHost,
    appVersion: 'crypto.me-xmtp-collector/1.0.0',
  }),
);

function writeJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://127.0.0.1');

  if (request.method === 'GET' && url.pathname === '/healthz') {
    return writeJson(response, 200, { status: 'ok' });
  }

  if (request.method !== 'GET' || url.pathname !== '/xmtp') {
    return writeJson(response, 404, { error: 'Not found' });
  }

  const address = url.searchParams.get('address');
  if (!address || !isEthereumAddress(address)) {
    return writeJson(response, 400, { error: 'A valid Ethereum address is required' });
  }

  try {
    const backendAttempt = backend.get();
    const payload = await withTimeout(
      backendAttempt.then((activeBackend) => collectXmtpProfile(address, {
        ethereumIdentifierKind: IdentifierKind.Ethereum,
        lookupInboxId: (identifier) => getInboxIdForIdentifier(activeBackend, identifier),
        fetchInboxStates: (inboxIds) => Client.fetchInboxStates(inboxIds, activeBackend),
      }, env)),
      lookupTimeoutMs,
      () => backend.invalidate(backendAttempt),
    );
    return writeJson(response, 200, payload);
  } catch (error) {
    console.error(JSON.stringify({
      event: 'xmtp_profile_lookup_failed',
      error: error instanceof Error ? error.message : 'unknown error',
    }));
    return writeJson(response, 502, {
      error: 'XMTP inbox lookup failed',
      code: 'XMTP_LOOKUP_FAILED',
    });
  }
});

server.requestTimeout = 20_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
server.listen(port, '0.0.0.0', () => {
  console.log(JSON.stringify({ event: 'xmtp_collector_listening', port, env }));
});
