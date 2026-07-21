import { NextApiRequest, NextApiResponse } from 'next';
import { createEnsPublicClient } from '@ensdomains/ensjs';
import { http } from 'viem';
import { mainnet } from 'viem/chains';

const alchemyRpcUrl =
  process.env.ALCHEMY_RPC_URL ||
  (process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined);

const rpcUrl = alchemyRpcUrl ?? 'https://rpc.ankr.com/eth';

const ensClient = createEnsPublicClient({
  chain: mainnet,
  transport: http(rpcUrl, { timeout: 8000, retryCount: 1, retryDelay: 300 }),
});

type XmtpEnv = 'local' | 'dev' | 'production';

function getXmtpEnv(): XmtpEnv {
  const env = process.env.XMTP_ENV;
  if (env === 'local' || env === 'dev' || env === 'production') return env;
  return 'production';
}

function isEnsName(input: string): boolean {
  return input.includes('.') && !input.startsWith('0x');
}

function isEthereumAddress(input: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(input);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => clearTimeout(timeoutId));
  });
}

function identifierKindToString(identifierKind: number): 'ethereum' | 'passkey' | 'unknown' {
  if (identifierKind === 0) return 'ethereum';
  if (identifierKind === 1) return 'passkey';
  return 'unknown';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCollectorIdentity(value: unknown, requireProperties: boolean): boolean {
  if (!isRecord(value)) return false;
  if (typeof value.identifier !== 'string' || !value.identifier.trim()) return false;
  if (value.kind !== 'ethereum' && value.kind !== 'passkey' && value.kind !== 'unknown') return false;
  if (value.kind === 'ethereum' && !isEthereumAddress(value.identifier)) return false;
  if (!requireProperties) return true;
  return typeof value.isViewedProfile === 'boolean' && typeof value.isRecovery === 'boolean';
}

function collectorIdentityKey(identity: Record<string, unknown>): string {
  const identifier = identity.kind === 'ethereum'
    ? String(identity.identifier).toLowerCase()
    : String(identity.identifier);
  return `${identity.kind}:${identifier}`;
}

function isCollectorPayload(value: unknown, expectedAddress: string): boolean {
  if (!isRecord(value)) return false;
  if (!isEthereumAddress(expectedAddress)) return false;
  if (value.schemaVersion !== 2 || value.source !== 'xmtp' || typeof value.registered !== 'boolean') return false;
  if (value.env !== 'local' && value.env !== 'dev' && value.env !== 'production') return false;
  if (!isCollectorIdentity(value.queriedIdentifier, false)) return false;
  if (!isRecord(value.queriedIdentifier) || value.queriedIdentifier.kind !== 'ethereum') return false;
  if (String(value.queriedIdentifier.identifier).toLowerCase() !== expectedAddress.toLowerCase()) return false;
  if (value.recoveryIdentifier !== null && !isCollectorIdentity(value.recoveryIdentifier, false)) return false;
  if (!Array.isArray(value.identities) || !value.identities.every((identity) => isCollectorIdentity(identity, true))) {
    return false;
  }
  if (
    !Array.isArray(value.connectedIdentities)
    || !value.connectedIdentities.every((identity) => isCollectorIdentity(identity, true))
  ) {
    return false;
  }

  const identities = value.identities as Array<Record<string, unknown>>;
  const connectedIdentities = value.connectedIdentities as Array<Record<string, unknown>>;
  const identityKeys = identities.map(collectorIdentityKey);
  if (new Set(identityKeys).size !== identityKeys.length) return false;

  const viewedIdentities = identities.filter((identity) => identity.isViewedProfile === true);
  const expectedConnectedKeys = new Set(
    identities
      .filter((identity) => identity.isViewedProfile === false)
      .map(collectorIdentityKey),
  );
  const connectedKeys = connectedIdentities.map(collectorIdentityKey);
  if (
    connectedIdentities.some((identity) => identity.isViewedProfile !== false)
    || new Set(connectedKeys).size !== connectedKeys.length
    || connectedKeys.length !== expectedConnectedKeys.size
    || connectedKeys.some((key) => !expectedConnectedKeys.has(key))
  ) {
    return false;
  }

  const recoveryIdentities = identities.filter((identity) => identity.isRecovery === true);
  if (value.recoveryIdentifier === null) {
    if (recoveryIdentities.length !== 0) return false;
  } else if (
    recoveryIdentities.length !== 1
    || collectorIdentityKey(recoveryIdentities[0])
      !== collectorIdentityKey(value.recoveryIdentifier as Record<string, unknown>)
  ) {
    return false;
  }
  if (
    value.installationCount !== null
    && (!Number.isInteger(value.installationCount) || (value.installationCount as number) < 0)
  ) {
    return false;
  }

  if (value.registered) {
    return typeof value.inboxId === 'string'
      && Boolean(value.inboxId.trim())
      && identities.length > 0
      && viewedIdentities.length === 1
      && viewedIdentities[0].kind === 'ethereum'
      && String(viewedIdentities[0].identifier).toLowerCase() === expectedAddress.toLowerCase();
  }

  return value.inboxId === null
    && value.recoveryIdentifier === null
    && value.identities.length === 0
    && value.connectedIdentities.length === 0;
}

interface XmtpIdentifier {
  identifier: string;
  identifierKind: number;
}

function identifiersMatch(left: XmtpIdentifier, right: XmtpIdentifier | undefined): boolean {
  if (!right || left.identifierKind !== right.identifierKind) return false;
  if (left.identifierKind === 0) {
    return left.identifier.toLowerCase() === right.identifier.toLowerCase();
  }
  return left.identifier === right.identifier;
}

interface XmtpInboxState {
  inboxId?: string;
  identifiers?: XmtpIdentifier[];
  recoveryIdentifier?: XmtpIdentifier;
  installations?: Array<{
    id?: string;
    clientTimestampNs?: bigint | string | number;
  }>;
}

interface XmtpRuntime {
  lookupInboxId: (
    identifier: XmtpIdentifier,
    env: XmtpEnv,
    gatewayHost?: string,
  ) => Promise<string | null>;
  fetchInboxStates: (
    inboxIds: string[],
    env: XmtpEnv,
    gatewayHost?: string,
  ) => Promise<XmtpInboxState[]>;
}

interface EnsResolver {
  getAddressRecord: (args: { name: string }) => Promise<{ value?: string | null } | null>;
}

interface XmtpDependencies {
  ensClient: EnsResolver;
  xmtp?: XmtpRuntime;
  fetchFn?: typeof fetch;
}

const defaultDependencies: XmtpDependencies = { ensClient, fetchFn: fetch };

export function createHandler(dependencies = defaultDependencies) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { ensClient, xmtp } = dependencies;

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { address } = req.query;
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Address or ENS name is required' });
    }

    if (!xmtp) {
      const proxyUrl = process.env.XMTP_SERVICE_URL;
      if (!proxyUrl) {
        return res.status(503).json({
          error: 'XMTP refresh requires a Node-compatible collector service',
          code: 'XMTP_COLLECTOR_UNAVAILABLE',
        });
      }

      try {
        const url = new URL(proxyUrl);
        url.searchParams.set('address', address);
        const headers = new Headers();
        if (process.env.XMTP_SERVICE_TOKEN) {
          headers.set('Authorization', `Bearer ${process.env.XMTP_SERVICE_TOKEN}`);
        }
        const response = await (dependencies.fetchFn ?? fetch)(url, {
          headers,
          // The collector permits up to 17 seconds for instance/port readiness
          // and then applies a 15-second end-to-end XMTP deadline. Keep this
          // below the enclosing 36-second service refresh budget.
          signal: AbortSignal.timeout(33000),
        });
        const payload: unknown = await response.json();
        if (response.ok && !isCollectorPayload(payload, address)) {
          return res.status(502).json({
            error: 'XMTP collector returned an invalid or incomplete v2 payload',
            code: 'XMTP_COLLECTOR_INVALID_RESPONSE',
          });
        }
        return res.status(response.status).json(payload);
      } catch (error) {
        return res.status(502).json({
          error: error instanceof Error ? error.message : 'XMTP collector request failed',
          code: 'XMTP_COLLECTOR_FAILED',
        });
      }
    }

    const { lookupInboxId, fetchInboxStates } = xmtp;

    const env = getXmtpEnv();
    const gatewayHost = process.env.XMTP_GATEWAY_HOST || undefined;

    let resolvedAddress = address;
    if (isEnsName(address)) {
      try {
        const addressRecord = await ensClient.getAddressRecord({ name: address });
        if (!addressRecord?.value || addressRecord.value === '0x0000000000000000000000000000000000000000') {
          return res.status(404).json({ error: 'ENS name not found or not resolved to a valid address' });
        }
        resolvedAddress = addressRecord.value;
      } catch (error) {
        console.error('[xmtp] Error resolving ENS name:', error);
        return res.status(400).json({ error: 'Invalid ENS name or resolution failed' });
      }
    } else if (!isEthereumAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address or ENS name format' });
    }

    try {
      const identifier = {
        identifier: resolvedAddress,
        identifierKind: 0, // IdentifierKind.Ethereum
      };

      const inboxId = await withTimeout(
        lookupInboxId(identifier, env, gatewayHost),
        8000,
        'XMTP inbox ID lookup timed out',
      );

      if (!inboxId) {
        return res.status(200).json({
          schemaVersion: 2,
          registered: false,
          inboxId: null,
          queriedIdentifier: { identifier: resolvedAddress, kind: 'ethereum' },
          recoveryIdentifier: null,
          identities: [],
          connectedIdentities: [],
          installationCount: 0,
          source: 'xmtp',
          env,
        });
      }

      const inboxStates = await withTimeout(
        fetchInboxStates([inboxId], env, gatewayHost),
        8000,
        'XMTP inbox state lookup timed out',
      );

      const inboxState = inboxStates?.[0];
      if (!inboxState) {
        throw new Error('XMTP inbox state lookup returned no state');
      }
      if (inboxState.inboxId && inboxState.inboxId !== inboxId) {
        throw new Error('XMTP inbox state lookup returned a mismatched inbox');
      }
      const identifiers = inboxState.identifiers || [];
      const recoveryIdentifier = inboxState.recoveryIdentifier;
      const normalizedInput = resolvedAddress.toLowerCase();

      const identities = identifiers.map((id) => ({
        identifier: id.identifier,
        kind: identifierKindToString(id.identifierKind),
        isViewedProfile: id.identifierKind === 0 && id.identifier.toLowerCase() === normalizedInput,
        isRecovery: identifiersMatch(id, recoveryIdentifier),
      }));

      const connectedIdentities = identities.filter((identity) => !identity.isViewedProfile);

      return res.status(200).json({
        schemaVersion: 2,
        registered: true,
        inboxId: inboxState.inboxId || inboxId,
        queriedIdentifier: { identifier: resolvedAddress, kind: 'ethereum' },
        recoveryIdentifier: recoveryIdentifier
          ? {
              identifier: recoveryIdentifier.identifier,
              kind: identifierKindToString(recoveryIdentifier.identifierKind),
            }
          : null,
        identities,
        connectedIdentities,
        installationCount: Array.isArray(inboxState.installations) ? inboxState.installations.length : null,
        source: 'xmtp',
        env,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[xmtp] Failed to fetch XMTP data:', message, error);
      return res.status(500).json({
        schemaVersion: 2,
        registered: false,
        inboxId: null,
        queriedIdentifier: { identifier: resolvedAddress, kind: 'ethereum' },
        recoveryIdentifier: null,
        identities: [],
        connectedIdentities: [],
        installationCount: null,
        source: 'xmtp',
        env,
        error: message,
      });
    }
  };
}

export default createHandler();
