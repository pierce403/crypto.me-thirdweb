import { NextApiRequest, NextApiResponse } from 'next';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function isEthereumAddress(input: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(input);
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getRecordPath(value: unknown, path: string[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function extractTotalUsd(payload: unknown): number | null {
  const candidates: string[][] = [
    ['data', 'attributes', 'total', 'value'],
    ['data', 'attributes', 'total', 'total_value'],
    ['data', 'attributes', 'total', 'positions_value'],
    ['data', 'attributes', 'total_value'],
    ['data', 'attributes', 'totalValue'],
    ['data', 'attributes', 'value'],
  ];

  for (const path of candidates) {
    const value = getRecordPath(payload, path);
    const numeric = toNumber(value);
    if (numeric !== null) return numeric;
  }

  // As a last resort, scan the `total` object for a reasonable numeric field.
  const total = getRecordPath(payload, ['data', 'attributes', 'total']);
  if (isRecord(total)) {
    for (const key of ['value', 'total_value', 'positions_value', 'networth', 'net_worth']) {
      const numeric = toNumber(total[key]);
      if (numeric !== null) return numeric;
    }
  }

  return null;
}

interface ZerionResult {
  totalUSD: number;
  currency: 'USD';
  profileUrl: string;
  source: string;
  error?: string;
}

const defaultDependencies = {
  fetchFn: fetch,
};

export function createHandler(dependencies = defaultDependencies) {
  return async function handler(req: NextApiRequest, res: NextApiResponse<ZerionResult | { error: string }>) {
    const { fetchFn } = dependencies;

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { address } = req.query;

    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Address is required' });
    }

    if (!isEthereumAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }

    const profileUrl = `https://app.zerion.io/${address}`;
    const apiKey = process.env.ZERION_API_KEY;

    if (!apiKey) {
      return res.status(200).json({
        totalUSD: 0,
        currency: 'USD',
        profileUrl,
        source: 'none',
        error: 'NO_API_KEY',
      });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const auth = Buffer.from(`${apiKey}:`).toString('base64');
      const response = await fetchFn(`https://api.zerion.io/v1/wallets/${address}/portfolio/?currency=usd`, {
        headers: {
          accept: 'application/json',
          authorization: `Basic ${auth}`,
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) {
        console.error(`Zerion API error: ${response.status} ${response.statusText}`);
        return res.status(200).json({
          totalUSD: 0,
          currency: 'USD',
          profileUrl,
          source: 'none',
          error: 'SERVICE_ERROR',
        });
      }

      const payload: unknown = await response.json();
      const totalUSD = extractTotalUsd(payload);

      if (totalUSD === null) {
        console.error('Zerion API: unexpected response shape');
        return res.status(200).json({
          totalUSD: 0,
          currency: 'USD',
          profileUrl,
          source: 'none',
          error: 'UNEXPECTED_RESPONSE',
        });
      }

      return res.status(200).json({
        totalUSD,
        currency: 'USD',
        profileUrl,
        source: 'zerion',
      });
    } catch (error) {
      console.error('Zerion service error:', error);
      return res.status(200).json({
        totalUSD: 0,
        currency: 'USD',
        profileUrl,
        source: 'none',
        error: 'SERVICE_ERROR',
      });
    }
  };
}

export default createHandler();

