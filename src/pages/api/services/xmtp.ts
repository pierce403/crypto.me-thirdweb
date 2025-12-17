import { NextApiRequest, NextApiResponse } from 'next';
import { createEnsPublicClient } from '@ensdomains/ensjs';
import { http } from 'viem';
import { mainnet } from 'viem/chains';
import { Client, getInboxIdForIdentifier } from '@xmtp/node-sdk';

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

const defaultDependencies = {
  ensClient,
  xmtp: {
    getInboxIdForIdentifier,
    Client,
  }
};

export function createHandler(dependencies = defaultDependencies) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { ensClient, xmtp } = dependencies;
    const { getInboxIdForIdentifier, Client } = xmtp;

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { address } = req.query;
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Address or ENS name is required' });
    }

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
        getInboxIdForIdentifier(identifier, env, gatewayHost),
        8000,
        'XMTP inbox ID lookup timed out',
      );

      if (!inboxId) {
        return res.status(200).json({
          inboxId: null,
          identities: [],
          connectedIdentities: [],
          source: 'xmtp',
          env,
        });
      }

      const inboxStates = await withTimeout(
        Client.inboxStateFromInboxIds([inboxId], env, gatewayHost),
        8000,
        'XMTP inbox state lookup timed out',
      );

      const inboxState = inboxStates?.[0];
      const identifiers = inboxState?.identifiers || [];
      const normalizedInput = resolvedAddress.toLowerCase();

      const identities = identifiers.map((id) => ({
        identifier: id.identifier,
        kind: identifierKindToString(id.identifierKind),
      }));

      const connectedIdentities = identifiers
        .filter((id) => !(id.identifierKind === 0 && id.identifier.toLowerCase() === normalizedInput))
        .map((id) => ({
          identifier: id.identifier,
          kind: identifierKindToString(id.identifierKind),
        }));

      return res.status(200).json({
        inboxId: inboxState?.inboxId || inboxId,
        identities,
        connectedIdentities,
        source: 'xmtp',
        env,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[xmtp] Failed to fetch XMTP data:', message, error);
      return res.status(500).json({
        inboxId: null,
        identities: [],
        connectedIdentities: [],
        source: 'xmtp',
        env,
        error: message,
      });
    }
  };
}

export default createHandler();
