const ETHEREUM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export function isEthereumAddress(value) {
  return typeof value === 'string' && ETHEREUM_ADDRESS_PATTERN.test(value);
}

function kindToString(identifierKind) {
  if (identifierKind === 0) return 'ethereum';
  if (identifierKind === 1) return 'passkey';
  return 'unknown';
}

function identityKey(identity) {
  const identifier = identity.identifierKind === 0
    ? identity.identifier.toLowerCase()
    : identity.identifier;
  return `${identity.identifierKind}:${identifier}`;
}

function identifiersMatch(left, right) {
  return Boolean(right) && identityKey(left) === identityKey(right);
}

export async function collectXmtpProfile(address, runtime, env = 'production') {
  if (!isEthereumAddress(address)) {
    throw new TypeError('A valid Ethereum address is required');
  }

  const queriedIdentifier = {
    identifier: address,
    identifierKind: runtime.ethereumIdentifierKind,
  };
  const inboxId = await runtime.lookupInboxId(queriedIdentifier);

  if (!inboxId) {
    return {
      schemaVersion: 2,
      registered: false,
      inboxId: null,
      queriedIdentifier: { identifier: address, kind: 'ethereum' },
      recoveryIdentifier: null,
      identities: [],
      connectedIdentities: [],
      installationCount: 0,
      source: 'xmtp',
      env,
    };
  }

  const states = await runtime.fetchInboxStates([inboxId]);
  const state = states?.[0];
  if (!state) throw new Error('XMTP inbox state lookup returned no state');
  if (state.inboxId !== inboxId) throw new Error('XMTP inbox state lookup returned a mismatched inbox');
  if (!Array.isArray(state.identifiers) || state.identifiers.length === 0) {
    throw new Error('XMTP inbox state lookup returned no identities');
  }

  const viewedAddress = address.toLowerCase();
  const recoveryIdentifier = state.recoveryIdentifier;
  const identities = state.identifiers.map((identity) => ({
    identifier: identity.identifier,
    kind: kindToString(identity.identifierKind),
    isViewedProfile:
      identity.identifierKind === runtime.ethereumIdentifierKind
      && identity.identifier.toLowerCase() === viewedAddress,
    isRecovery: identifiersMatch(identity, recoveryIdentifier),
  }));

  if (!identities.some((identity) => identity.isViewedProfile)) {
    throw new Error('XMTP inbox state does not contain the queried identity');
  }

  return {
    schemaVersion: 2,
    registered: true,
    inboxId,
    queriedIdentifier: { identifier: address, kind: 'ethereum' },
    recoveryIdentifier: recoveryIdentifier
      ? {
          identifier: recoveryIdentifier.identifier,
          kind: kindToString(recoveryIdentifier.identifierKind),
        }
      : null,
    identities,
    connectedIdentities: identities.filter((identity) => !identity.isViewedProfile),
    installationCount: Array.isArray(state.installations) ? state.installations.length : null,
    source: 'xmtp',
    env,
  };
}
