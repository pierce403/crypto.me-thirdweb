import { createEnsPublicClient } from '@ensdomains/ensjs';
import { fallback, http } from 'viem';
import { mainnet } from 'viem/chains';

const PUBLIC_ENS_RPC_URLS = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth.drpc.org',
] as const;

function configuredRpcUrl(env: NodeJS.ProcessEnv): string | undefined {
  return env.ALCHEMY_RPC_URL
    ?? (env.ALCHEMY_API_KEY
      ? `https://eth-mainnet.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`
      : undefined);
}

export function getEnsRpcUrls(env: NodeJS.ProcessEnv = process.env): string[] {
  return Array.from(new Set([
    configuredRpcUrl(env),
    ...PUBLIC_ENS_RPC_URLS,
  ].filter((url): url is string => Boolean(url))));
}

export function createAppEnsClient(env: NodeJS.ProcessEnv = process.env) {
  const transports = getEnsRpcUrls(env).map((url) => http(url, {
    timeout: 3000,
    retryCount: 0,
  }));

  return createEnsPublicClient({
    chain: mainnet,
    // Public RPCs occasionally reject a specific edge provider. Keep the
    // resolver bounded and fail over without background ranking requests.
    transport: fallback(transports, {
      rank: false,
      retryCount: 0,
    }),
  });
}

export function safeEnsError(error: unknown): {
  name: string;
  shortMessage?: string;
  status?: number;
} {
  const errorRecord = error && typeof error === 'object'
    ? error as { name?: unknown; shortMessage?: unknown; status?: unknown; cause?: unknown }
    : null;
  const causeRecord = errorRecord?.cause && typeof errorRecord.cause === 'object'
    ? errorRecord.cause as { shortMessage?: unknown; status?: unknown }
    : null;
  const shortMessage = typeof errorRecord?.shortMessage === 'string'
    ? errorRecord.shortMessage
    : (typeof causeRecord?.shortMessage === 'string' ? causeRecord.shortMessage : undefined);
  const sanitizedShortMessage = shortMessage
    ?.replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, '[redacted-url]')
    .slice(0, 200);
  const statusCandidate = errorRecord?.status ?? causeRecord?.status;

  return {
    name: typeof errorRecord?.name === 'string' ? errorRecord.name : 'UnknownError',
    ...(sanitizedShortMessage ? { shortMessage: sanitizedShortMessage } : {}),
    ...(typeof statusCandidate === 'number' ? { status: statusCandidate } : {}),
  };
}

export const appEnsClient = createAppEnsClient();
