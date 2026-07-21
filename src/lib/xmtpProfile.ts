export type XmtpIdentityKind = 'ethereum' | 'passkey' | 'unknown';

export interface XmtpDisplayIdentity {
  identifier: string;
  kind: XmtpIdentityKind;
  isViewedProfile: boolean;
  isRecovery: boolean;
  explorerUrl: string | null;
}

interface IdentityCandidate {
  identifier?: unknown;
  kind?: unknown;
  identifierKind?: unknown;
  isRecovery?: unknown;
}

const ETHEREUM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export function isEthereumIdentity(identifier: string): boolean {
  return ETHEREUM_ADDRESS_PATTERN.test(identifier);
}

export function getXmtpMessageUrl(
  address: string | null | undefined,
  environment: string | null | undefined,
): string | null {
  if (environment !== 'production' || !address || !isEthereumIdentity(address)) return null;
  return `https://xmtp.im/${encodeURIComponent(address)}`;
}

export function getEthereumExplorerUrl(identifier: string): string | null {
  if (!isEthereumIdentity(identifier)) return null;
  return `https://etherscan.io/address/${encodeURIComponent(identifier)}`;
}

function normalizeKind(candidate: IdentityCandidate): XmtpIdentityKind {
  if (candidate.kind === 'ethereum' || candidate.identifierKind === 0) return 'ethereum';
  if (candidate.kind === 'passkey' || candidate.identifierKind === 1) return 'passkey';
  return 'unknown';
}

function normalizeCandidate(value: unknown): (IdentityCandidate & { identifier: string }) | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as IdentityCandidate;
  if (typeof candidate.identifier !== 'string' || !candidate.identifier.trim()) return null;
  return { ...candidate, identifier: candidate.identifier.trim() };
}

function identityKey(identifier: string, kind: XmtpIdentityKind): string {
  return `${kind}:${kind === 'ethereum' ? identifier.toLowerCase() : identifier}`;
}

export function getXmtpIdentities(
  data: Record<string, unknown>,
  viewedAddress: string | null | undefined,
): XmtpDisplayIdentity[] {
  const canonicalIdentities = Array.isArray(data.identities)
    ? data.identities
    : Array.isArray(data.identifiers)
      ? data.identifiers
      : [];
  const connectedIdentities = Array.isArray(data.connectedIdentities) ? data.connectedIdentities : [];
  const recoveryCandidate = normalizeCandidate(data.recoveryIdentifier);
  const recoveryKind = recoveryCandidate ? normalizeKind(recoveryCandidate) : null;
  const recoveryKey = recoveryCandidate && recoveryKind
    ? identityKey(recoveryCandidate.identifier, recoveryKind)
    : null;
  const normalizedViewedAddress = viewedAddress?.toLowerCase() ?? null;

  const hasCanonicalIdentities = canonicalIdentities.some((value) => normalizeCandidate(value) !== null);
  const candidates = hasCanonicalIdentities
    ? canonicalIdentities
    : [
        ...(data.inboxId && viewedAddress && isEthereumIdentity(viewedAddress)
          ? [{ identifier: viewedAddress, kind: 'ethereum' }]
          : []),
        ...connectedIdentities,
      ];

  const seen = new Set<string>();
  const identities: XmtpDisplayIdentity[] = [];

  for (const value of candidates) {
    const candidate = normalizeCandidate(value);
    if (!candidate) continue;

    const kind = normalizeKind(candidate);
    const key = identityKey(candidate.identifier, kind);
    if (seen.has(key)) continue;
    seen.add(key);

    identities.push({
      identifier: candidate.identifier,
      kind,
      isViewedProfile:
        kind === 'ethereum' && normalizedViewedAddress !== null
          ? candidate.identifier.toLowerCase() === normalizedViewedAddress
          : false,
      isRecovery: candidate.isRecovery === true || recoveryKey === key,
      explorerUrl: kind === 'ethereum' ? getEthereumExplorerUrl(candidate.identifier) : null,
    });
  }

  return identities;
}
