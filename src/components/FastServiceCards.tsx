import React from 'react';
import {
  Box,
  Text,
  VStack,
  HStack,
  Badge,
  Link,
  Skeleton,
  Image as ChakraImage,
  Button
} from '@chakra-ui/react';
import Image from 'next/image';
import { getXmtpIdentities, getXmtpMessageUrl } from '../lib/xmtpProfile';

interface ServiceCardProps {
  data: Record<string, unknown> | null;
  loading?: boolean;
  serviceName: string;
  icon?: string;
  description?: string;
  error?: {
    lastError: string;
    errorCount: number;
    lastAttempt: string;
  } | null;
  lastUpdated?: string | null;
  onRefresh?: () => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  data,
  loading = false,
  serviceName,
  icon,
  description,
  error,
  lastUpdated,
  onRefresh
}) => {
  const isEmpty = !data || (typeof data === 'object' && Object.keys(data).length === 0);

  const formatLastUpdated = (timestamp: string | null) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getStatusMessage = () => {
    if (loading) return 'Loading...';

    // Handle missing API key/Pending integration explicitly
    const hasApiKeyError = data && (data.error === 'NO_API_KEY' || data.error === 'OPENSEA_API_KEY_REQUIRED' || data.error === 'API_INTEGRATION_PENDING');
    if (hasApiKeyError) {
      if (data?.error === 'API_INTEGRATION_PENDING') {
        return 'Pending API Integration';
      }
      return 'No API Key Configured';
    }

    if (error && isEmpty) {
      return 'Service unavailable';
    }

    if (error && !isEmpty) {
      // Show when data was last successfully updated, even if recent update failed
      return lastUpdated ? `Data from ${formatLastUpdated(lastUpdated)} ` : 'Using cached data';
    }

    if (lastUpdated) {
      return `Successfully updated ${formatLastUpdated(lastUpdated)} `;
    }

    if (isEmpty) {
      return 'No data available';
    }

    return 'Data loaded successfully';
  };

  const getStatusColor = () => {
    if (loading) return 'fg.muted';

    // Check for explicit API errors in data payload
    const hasApiKeyError = data && (data.error === 'NO_API_KEY' || data.error === 'OPENSEA_API_KEY_REQUIRED' || data.error === 'API_INTEGRATION_PENDING');
    if (hasApiKeyError) return 'fg.muted';

    if (error && isEmpty) return 'fg.error';
    if (error && !isEmpty) return 'fg.warning';
    if (lastUpdated || !isEmpty) return 'fg.success';
    return 'fg.muted';
  };

  // Info Icon Component
  const InfoIcon = () => (
    <Box
      as="span"
      color="fg.muted"
      cursor="help"
      _hover={{ color: "blue.fg" }}
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      width="16px"
      height="16px"
      borderRadius="full"
      border="1px solid"
      borderColor="currentColor"
      fontSize="xs"
      ml="auto"
      title={`Last updated: ${lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Never'}`}
    >
      i
    </Box>
  );

  const renderContent = () => {
    if (!data) return null;

    switch (serviceName) {
      case 'ENS':
        return <ENSContent data={data} />;
      case 'XMTP':
        return <XMTPContent data={data} />;
      case 'Farcaster':
        return <FarcasterContent data={data} />;
      case 'Alchemy':
      case 'Top Crypto Holdings':
        return <AlchemyContent data={data} />;
      case 'OpenSea':
        return <OpenSeaContent data={data} />;
      case 'DeBank':
        return <DeBankContent data={data} />;
      case 'Zerion':
        return <ZerionContent data={data} />;
      case 'Icebreaker':
        return <IcebreakerContent data={data} />;
      case 'Human Passport':
        return <HumanPassportContent data={data} />;
      case 'Decentraland':
        return <DecentralandContent data={data} />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Box
        data-testid="service-card"
        data-service-name={serviceName}
        p={4}
        borderWidth={1}
        borderRadius="lg"
        borderColor="border"
        bg="bg.panel"
        shadow="sm"
        minH="200px"
      >
        <VStack gap={3} align="stretch">
          <HStack gap={2} align="center">
            <Text fontSize="lg">{icon || '🔧'}</Text>
            <Text fontWeight="bold" color="fg">{serviceName}</Text>
          </HStack>

          <Skeleton height="20px" />
          <Skeleton height="20px" />
          <Skeleton height="60px" />
        </VStack>
      </Box>
    );
  }

  // Show error state if there's an error and no data or empty data
  if (error && isEmpty) {
    return (
      <Box
        data-testid="service-card"
        data-service-name={serviceName}
        p={4}
        borderWidth={1}
        borderRadius="lg"
        borderColor="border.error"
        bg="bg.error"
        shadow="sm"
        minH="200px"
      >
        <VStack gap={3} align="stretch">
          <HStack gap={2} align="center">
            <Text fontSize="lg">❌</Text>
            <Text fontWeight="bold" color="fg.error">{serviceName}</Text>
            <Badge colorScheme="red" variant="subtle" fontSize="xs">
              Error
            </Badge>
          </HStack>

          <Box p={3} bg="red.subtle" borderRadius="md" border="1px solid" borderColor="border.error">
            <Text fontSize="sm" color="fg.error" fontWeight="semibold">Service Error</Text>
            <Text fontSize="xs" color="fg.error" mt={1}>
              {error.lastError}
            </Text>
            <Text fontSize="xs" color="fg.error" mt={2}>
              Last attempt: {new Date(error.lastAttempt).toLocaleString()}
            </Text>
            {error.errorCount > 1 && (
              <Text fontSize="xs" color="fg.error">
                Failed {error.errorCount} times
              </Text>
            )}
          </Box>

          <Text fontSize="xs" color="fg.muted" textAlign="center">
            Data will be retried automatically
          </Text>
        </VStack>
      </Box>
    );
  }

  if (isEmpty) {
    return (
      <Box
        data-testid="service-card"
        data-service-name={serviceName}
        p={4}
        borderWidth={1}
        borderRadius="lg"
        borderColor="border"
        bg="bg.muted"
        shadow="sm"
        minH="200px"
      >
        <VStack gap={3} align="stretch">
          <HStack gap={2} align="center" width="100%">
            <Text fontSize="lg">{icon || '🔧'}</Text>
            <Text fontWeight="bold" color="fg.muted">{serviceName}</Text>
            {lastUpdated && <InfoIcon />}
          </HStack>

          <Text fontSize="sm" color="fg.muted" textAlign="center">
            {description || 'No data available'}
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box
      data-testid="service-card"
      data-service-name={serviceName}
      p={4}
      borderWidth={1}
      borderRadius="lg"
      borderColor="border"
      bg="bg.panel"
      shadow="sm"
      minH="200px"
      transition="all 0.2s"
      _hover={{ shadow: "md", borderColor: "blue.emphasized" }}
      position="relative"
    >
      <VStack gap={3} align="stretch">
        <HStack gap={2} align="center" width="100%">
          <Text fontSize="lg">{icon || '🔧'}</Text>
          <Text fontWeight="bold" color="fg">{serviceName}</Text>
          <InfoIcon />
        </HStack>

        {renderContent()}

        {/* Status footer - always shown */}
        <Box borderTop="1px solid" borderColor="border.muted" pt={2} mt={2}>
          <VStack gap={2}>
            {error && (
              <Box p={2} bg="bg.warning" borderRadius="md" border="1px solid" borderColor="border.warning" width="100%">
                <Text fontSize="xs" color="fg.warning">
                  ⚠️ Last error: {error.lastError}
                </Text>
              </Box>
            )}
            <Text fontSize="xs" color={getStatusColor()} textAlign="center">
              {getStatusMessage()}
            </Text>
          </VStack>
        </Box>
      </VStack>

      {/* Refresh button positioned in bottom right corner */}
      {onRefresh && (
        <Button
          size="xs"
          variant="ghost"
          colorScheme="blue"
          onClick={onRefresh}
          disabled={loading}
          position="absolute"
          bottom="8px"
          right="8px"
          width="24px"
          height="24px"
          minWidth="24px"
          borderRadius="md"
          _hover={{ bg: "blue.subtle" }}
          title={loading ? 'Refreshing...' : 'Refresh'}
        >
          <Text fontSize="14px">{loading ? '⟳' : '↻'}</Text>
        </Button>
      )}
    </Box>
  );
};

const ENSContent: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const primaryName = data.primaryName as string | null;
  const avatar = data.avatar as string | null;
  const otherNames = data.otherNames as string[] | undefined;
  const profileUrl = data.profileUrl as string | undefined;

  return (
    <VStack gap={3} align="stretch">
      {primaryName && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">Primary Name:</Text>
          <Text fontSize="md" color="fg">{primaryName}</Text>
        </Box>
      )}

      {avatar && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">Avatar:</Text>
          <ChakraImage src={avatar} alt="ENS Avatar" maxH="80px" borderRadius="md" />
        </Box>
      )}

      {otherNames && otherNames.length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">Other Names:</Text>
          {otherNames.slice(0, 3).map((name, index) => (
            <Text key={index} fontSize="sm" color="fg">{name}</Text>
          ))}
          {otherNames.length > 3 && (
            <Text fontSize="xs" color="fg.muted">+{otherNames.length - 3} more</Text>
          )}
        </Box>
      )}

      {profileUrl && (
        <Link href={profileUrl} target="_blank" rel="noopener noreferrer" color="blue.fg" fontSize="sm">
          View on ENS ↗
        </Link>
      )}
    </VStack>
  );
};

const FarcasterContent: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const username = data.username as string | undefined;
  const farname = data.farname as string | undefined;
  const basename = data.basename as string | undefined;
  const fid = data.fid as number | undefined;
  const handle = farname ?? username;
  const displayName = data.displayName as string | undefined;
  const followerCount = data.followerCount as number | undefined;
  const followingCount = data.followingCount as number | undefined;
  const powerBadge = data.powerBadge as boolean | undefined;
  const bio = data.bio as string | undefined;
  const profileUrl = data.profileUrl as string | undefined;
  const neynarScore = data.neynarScore as number | undefined;
  const walletAddress = data.walletAddress as string | undefined;
  const custodyAddress = data.custodyAddress as string | undefined;
  const connectedAddresses = data.connectedAddresses as string[] | undefined;
  const verifiedAddresses = data.verifiedAddresses as Record<string, unknown> | undefined;
  const connectedAccounts = data.connectedAccounts as Array<{ platform: string; username: string }> | undefined;

  const formatAddress = (address: string) => {
    if (!address.startsWith('0x') || address.length < 10) return address;
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  };

  const ethAddresses = (() => {
    const fromVerified = verifiedAddresses && Array.isArray(verifiedAddresses.ethAddresses)
      ? verifiedAddresses.ethAddresses
      : undefined;
    const fromConnected = Array.isArray(connectedAddresses) ? connectedAddresses : undefined;
    const addresses = (fromVerified ?? fromConnected ?? []).filter((value): value is string => typeof value === 'string');
    const unique = new Set(addresses.map((value) => value.toLowerCase()));
    return Array.from(unique).map((lower) => addresses.find((value) => value.toLowerCase() === lower) as string);
  })();

  const solAddresses = (() => {
    const value = verifiedAddresses?.solAddresses;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  })();

  const ensDomains = (() => {
    const value = verifiedAddresses?.ensDomains;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  })();

  return (
    <VStack gap={3} align="stretch">
      {handle && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">Farname:</Text>
          <HStack justify="space-between" align="baseline">
            <Text fontSize="md" color="fg">@{handle}</Text>
            {fid !== undefined && (
              <Text fontSize="xs" color="fg.muted">FID {fid}</Text>
            )}
          </HStack>
        </Box>
      )}

      {displayName && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">Display Name:</Text>
          <Text fontSize="md" color="fg">{displayName}</Text>
        </Box>
      )}

      {(username && farname && farname !== username) && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">Username (API):</Text>
          <Text fontSize="sm" color="fg">@{username}</Text>
        </Box>
      )}

      {basename && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">Basename:</Text>
          <Text fontSize="sm" color="fg">{basename}</Text>
        </Box>
      )}

      {(walletAddress || custodyAddress) && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">Wallets:</Text>
          {walletAddress && (
            <HStack gap={2}>
              <Text fontSize="xs" color="fg.muted">Lookup:</Text>
              <Link
                href={`/${walletAddress}`}
                fontSize="xs"
                color="blue.fg"
                fontFamily="mono"
                title={walletAddress}
              >
                {formatAddress(walletAddress)}
              </Link>
            </HStack>
          )}
          {custodyAddress && custodyAddress !== walletAddress && (
            <HStack gap={2}>
              <Text fontSize="xs" color="fg.muted">Custody:</Text>
              <Link
                href={`/${custodyAddress}`}
                fontSize="xs"
                color="blue.fg"
                fontFamily="mono"
                title={custodyAddress}
              >
                {formatAddress(custodyAddress)}
              </Link>
            </HStack>
          )}
        </Box>
      )}

      {(ethAddresses.length > 0 || solAddresses.length > 0 || ensDomains.length > 0 || (connectedAccounts && connectedAccounts.length > 0)) && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">Connected Identities:</Text>

          {ethAddresses.length > 0 && (
            <Box mt={1}>
              <Text fontSize="xs" color="fg.muted">Verified ETH wallets ({ethAddresses.length})</Text>
              <VStack gap={0} align="stretch">
                {ethAddresses.slice(0, 3).map((address, index) => (
                  <Link
                    key={`${address}-${index}`}
                    href={`/${address}`}
                    fontSize="xs"
                    color="blue.fg"
                    fontFamily="mono"
                    title={address}
                    display="block"
                  >
                    {formatAddress(address)}
                  </Link>
                ))}
                {ethAddresses.length > 3 && (
                  <Text fontSize="xs" color="fg.muted">+{ethAddresses.length - 3} more</Text>
                )}
              </VStack>
            </Box>
          )}

          {solAddresses.length > 0 && (
            <Box mt={2}>
              <Text fontSize="xs" color="fg.muted">Verified Solana wallets ({solAddresses.length})</Text>
              <VStack gap={0} align="stretch">
                {solAddresses.slice(0, 3).map((address, index) => (
                  <Text key={`${address}-${index}`} fontSize="xs" color="fg" fontFamily="mono" title={address}>
                    {address.length > 16 ? `${address.slice(0, 8)}…${address.slice(-4)}` : address}
                  </Text>
                ))}
                {solAddresses.length > 3 && (
                  <Text fontSize="xs" color="fg.muted">+{solAddresses.length - 3} more</Text>
                )}
              </VStack>
            </Box>
          )}

          {ensDomains.length > 0 && (
            <Box mt={2}>
              <Text fontSize="xs" color="fg.muted">Verified names ({ensDomains.length})</Text>
              <VStack gap={0} align="stretch">
                {ensDomains.slice(0, 3).map((name, index) => (
                  <Text key={`${name}-${index}`} fontSize="xs" color="fg" truncate title={name}>
                    {name}
                  </Text>
                ))}
                {ensDomains.length > 3 && (
                  <Text fontSize="xs" color="fg.muted">+{ensDomains.length - 3} more</Text>
                )}
              </VStack>
            </Box>
          )}

          {connectedAccounts && connectedAccounts.length > 0 && (
            <Box mt={2}>
              <Text fontSize="xs" color="fg.muted">Linked accounts ({connectedAccounts.length})</Text>
              <VStack gap={0} align="stretch">
                {connectedAccounts.slice(0, 3).map((account, index) => (
                  <Text key={`${account.platform}-${account.username}-${index}`} fontSize="xs" color="fg">
                    {account.platform}: {account.username}
                  </Text>
                ))}
                {connectedAccounts.length > 3 && (
                  <Text fontSize="xs" color="fg.muted">+{connectedAccounts.length - 3} more</Text>
                )}
              </VStack>
            </Box>
          )}
        </Box>
      )}

      {(followerCount !== undefined) && (
        <HStack gap={4}>
          {followerCount !== undefined && (
            <Box>
              <Text fontSize="xs" color="fg.muted">Followers</Text>
              <Text fontSize="lg" fontWeight="bold" color="purple.fg">{followerCount.toLocaleString()}</Text>
            </Box>
          )}
          {followingCount !== undefined && (
            <Box>
              <Text fontSize="xs" color="fg.muted">Following</Text>
              <Text fontSize="lg" fontWeight="bold" color="fg">{followingCount.toLocaleString()}</Text>
            </Box>
          )}
          {powerBadge !== undefined && (
            <Box>
              <Text fontSize="xs" color="fg.muted">Power Badge</Text>
              <Text fontSize="lg" fontWeight="bold" color={powerBadge ? 'green.fg' : 'fg.muted'}>
                {powerBadge ? 'Yes' : 'No'}
              </Text>
            </Box>
          )}
        </HStack>
      )}

      {bio && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">Bio:</Text>
          <Text fontSize="sm" color="fg" truncate>{bio}</Text>
        </Box>
      )}

      {neynarScore !== undefined && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">Neynar Score:</Text>
          <HStack align="baseline">
            <Text fontSize="lg" fontWeight="bold" color={
              neynarScore >= 0.7 ? "green.fg" :
                neynarScore >= 0.4 ? "yellow.fg" :
                  "red.fg"
            }>
              {(neynarScore * 100).toFixed(0)}%
            </Text>
            <Badge
              colorScheme={
                neynarScore >= 0.7 ? "green" :
                  neynarScore >= 0.4 ? "yellow" :
                    "red"
              }
              variant="subtle"
            >
              {
                neynarScore >= 0.7 ? "High" :
                  neynarScore >= 0.4 ? "Medium" :
                    "Low"
              }
            </Badge>
            <Text fontSize="xs" color="fg.muted">({neynarScore.toFixed(3)})</Text>
          </HStack>
        </Box>
      )}

      {profileUrl && (
        <Link href={profileUrl} target="_blank" rel="noopener noreferrer" color="purple.fg" fontSize="sm">
          View on Farcaster ↗
        </Link>
      )}
    </VStack>
  );
};

const formatUsd = (value: number): string => {
  if (value === 0) return '$0.00';
  if (value > 0 && value < 0.01) return '<$0.01';

  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: value >= 1 ? 2 : 4,
    maximumFractionDigits: value >= 1 ? 2 : 4,
  });
};

const formatAssetAmount = (value: number | string): string => {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return String(value);

  return amount.toLocaleString(undefined, {
    maximumFractionDigits: amount >= 1 ? 4 : 8,
  });
};

const formatNetworkName = (network: string): string =>
  network
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

const AlchemyContent: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const totalValueUsd = data.totalValueUsd as number | undefined;
  const totalHoldings = data.totalHoldings as number | undefined;
  const topHoldings = data.topHoldings as Array<{
    name: string;
    symbol: string;
    balance: number | string;
    usdPrice: number;
    usdValue: number;
    logoUrl?: string;
    network: string;
    tokenAddress?: string | null;
    isNative?: boolean;
  }> | undefined;
  const networks = data.networks as string[] | undefined;
  const source = data.source as string | undefined;
  const error = data.error as string | undefined;
  const warning = data.warning as string | undefined;
  const valueSemantics = data.valueSemantics as string | undefined;
  const isNativeOnly =
    data.schemaVersion === 4 &&
    valueSemantics === 'native-only';
  const isExactPricedPortfolio = (
    data.schemaVersion === 4 &&
    data.isPartial === false &&
    data.scanComplete === true &&
    valueSemantics === 'priced-total'
  );
  const isPartial = !isExactPricedPortfolio;
  const isPricedLowerBound = isPartial && !isNativeOnly;
  const sourceLabel =
    source === 'etherscan+alchemy'
      ? 'Etherscan + Alchemy'
      : source === 'etherscan'
        ? 'Etherscan'
        : source === 'alchemy'
          ? 'Alchemy'
          : undefined;

  if (error === 'NO_API_KEY') {
    return (
      <VStack gap={3} align="stretch">
        <Box p={3} bg="bg.info" borderRadius="md" border="1px solid" borderColor="border.info">
          <Text fontSize="sm" color="fg.info" fontWeight="semibold">API Key Required</Text>
          <Text fontSize="xs" color="fg.info">
            Add ALCHEMY_API_KEY for native balances and an Etherscan Standard API key for ERC-20 holdings.
          </Text>
        </Box>
        <Link href="https://docs.etherscan.io/api-reference/endpoint/addresstokenbalance" target="_blank" rel="noopener noreferrer" color="blue.fg" fontSize="sm">
          Etherscan holdings API ↗
        </Link>
      </VStack>
    );
  }

  if (
    data.schemaVersion !== 4 &&
    (
      (source !== undefined && source !== 'none') ||
      typeof totalValueUsd === 'number' ||
      Boolean(topHoldings?.length)
    )
  ) {
    return (
      <Box p={3} bg="bg.info" borderRadius="md" border="1px solid" borderColor="border.info">
        <Text fontSize="sm" color="fg.info" fontWeight="semibold">
          Refreshing holdings valuation
        </Text>
        <Text fontSize="xs" color="fg.info" mt={1}>
          The previous provider sample was incomplete, so its total is hidden while a corrected valuation is collected.
        </Text>
      </Box>
    );
  }

  return (
    <VStack gap={3} align="stretch">
      {source !== 'none' && typeof totalValueUsd === 'number' && Number.isFinite(totalValueUsd) && (
        <Box p={3} bg="blue.subtle" borderRadius="lg" border="1px solid" borderColor="blue.muted">
          <Text fontSize="xs" color="fg.muted" fontWeight="semibold">
            {isNativeOnly
              ? 'Known native value'
              : isPartial
                ? 'Known priced value'
                : 'Priced portfolio value'}
          </Text>
          <Text fontSize="2xl" lineHeight="shorter" fontWeight="bold" color="blue.fg">
            {isPricedLowerBound ? '≥' : ''}{formatUsd(totalValueUsd)}
          </Text>
          <HStack gap={2} mt={1} flexWrap="wrap">
            {typeof totalHoldings === 'number' && (
              <Text fontSize="xs" color="fg.muted">
                {isNativeOnly
                  ? `${totalHoldings.toLocaleString()} native ${totalHoldings === 1 ? 'balance' : 'balances'} found`
                  : `${totalHoldings.toLocaleString()} priced ${totalHoldings === 1 ? 'asset' : 'assets'}${isPartial ? ' found' : ''}`}
              </Text>
            )}
            {isPartial && !isNativeOnly && (
              <>
                <Text fontSize="xs" color="fg.muted" aria-hidden="true">•</Text>
                <Text fontSize="xs" color="fg.muted">Partial scan</Text>
              </>
            )}
            {networks && networks.length > 0 && (
              <>
                <Text fontSize="xs" color="fg.muted" aria-hidden="true">•</Text>
                <Text fontSize="xs" color="fg.muted">
                  {networks.length} {networks.length === 1 ? 'network' : 'networks'}
                </Text>
              </>
            )}
          </HStack>
        </Box>
      )}

      {warning === 'ETHERSCAN_API_KEY_REQUIRED' && (
        <Box p={3} bg="bg.info" borderRadius="md" border="1px solid" borderColor="border.info">
          <Text fontSize="xs" color="fg.info">
            Curated ERC-20 values require an Etherscan Standard API key. Native balances are shown without claiming a full portfolio total.
          </Text>
        </Box>
      )}

      {warning === 'ETHERSCAN_API_UNAVAILABLE' && (
        <Box p={3} bg="bg.warning" borderRadius="md" border="1px solid" borderColor="border.warning">
          <Text fontSize="xs" color="fg.warning">
            Etherscan token holdings are currently incomplete. Only verified data returned by the providers is shown.
          </Text>
        </Box>
      )}

      {topHoldings && topHoldings.length > 0 ? (
        <Box>
          <HStack justify="space-between" align="baseline" mb={2}>
            <Text fontSize="sm" fontWeight="semibold" color="fg">
              {isNativeOnly
                ? 'Native balances'
                : isPartial
                  ? 'Top holdings found'
                  : 'Top crypto holdings'}
            </Text>
            <Text fontSize="xs" color="fg.muted">By USD value</Text>
          </HStack>
          <VStack gap={2} align="stretch">
            {topHoldings.slice(0, 8).map((holding, index) => (
              <Box
                key={`${holding.network}:${holding.tokenAddress || holding.symbol}:${index}`}
                p={2.5}
                bg="bg.muted"
                borderRadius="md"
                border="1px solid"
                borderColor="border"
              >
                <HStack gap={2.5} align="center">
                  <Text width="18px" flexShrink={0} fontSize="xs" color="fg.muted" textAlign="center">
                    {index + 1}
                  </Text>
                  <Box
                    width="32px"
                    height="32px"
                    flexShrink={0}
                    bg="bg.emphasized"
                    borderRadius="full"
                    overflow="hidden"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    {holding.logoUrl ? (
                      <ChakraImage
                        src={holding.logoUrl}
                        alt=""
                        width="32px"
                        height="32px"
                        objectFit="cover"
                        loading="lazy"
                      />
                    ) : (
                      <Text fontSize="xs" fontWeight="bold" color="fg.muted">
                        {(holding.symbol || holding.name).slice(0, 2).toUpperCase()}
                      </Text>
                    )}
                  </Box>
                  <VStack align="stretch" gap={0} flex={1} minW={0}>
                    <HStack justify="space-between" gap={2} align="baseline">
                      <Text fontSize="sm" fontWeight="semibold" color="fg" truncate>
                        {holding.symbol || holding.name}
                      </Text>
                      <Text fontSize="sm" color="green.fg" fontWeight="bold" whiteSpace="nowrap">
                        {formatUsd(holding.usdValue)}
                      </Text>
                    </HStack>
                    <HStack justify="space-between" gap={2} align="baseline">
                      <HStack gap={1} minW={0}>
                        <Text fontSize="xs" color="fg.muted" truncate>{holding.name}</Text>
                        {holding.network && (
                          <Badge size="xs" variant="subtle" colorScheme="blue" flexShrink={0}>
                            {formatNetworkName(holding.network)}
                          </Badge>
                        )}
                      </HStack>
                      <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap">
                        {formatAssetAmount(holding.balance)}
                      </Text>
                    </HStack>
                    {typeof holding.usdPrice === 'number' && Number.isFinite(holding.usdPrice) && (
                      <Text fontSize="xs" color="fg.muted" textAlign="right">
                        {formatUsd(holding.usdPrice)} each
                      </Text>
                    )}
                  </VStack>
                </HStack>
              </Box>
            ))}
          </VStack>
        </Box>
      ) : (
        !error && source !== 'none' && (
          <Box p={3} bg="bg.muted" borderRadius="md" border="1px solid" borderColor="border">
            <Text fontSize="sm" color="fg.muted" textAlign="center">
              {isNativeOnly
                ? 'No priced native balances found.'
                : 'No priced crypto holdings found.'}
            </Text>
          </Box>
        )
      )}

      <HStack justify="space-between" align="center" flexWrap="wrap">
        {sourceLabel && (
          <Text fontSize="xs" color="fg.muted">Source: {sourceLabel}</Text>
        )}
        {networks && networks.length > 0 && (
          <Text fontSize="xs" color="fg.muted" truncate>
            {networks.map(formatNetworkName).join(' · ')}
          </Text>
        )}
      </HStack>
    </VStack>
  );
};

const OpenSeaContent: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  type OpenSeaNFT = {
    name: string;
    collection: string;
    image?: string;
    floorPrice?: number;
    estimatedValue?: number;
    estimatedValueUsd?: number;
    estimatedValueSource?: string;
    valuationSource?: string;
    estimateSource?: string;
    valueLabel?: string;
    currency?: string;
    permalink?: string;
    rarity?: string;
  };

  const rawTopValuedNFTs = data.topValuedNFTs as OpenSeaNFT[] | undefined;
  const rawNftPreview = data.nftPreview as OpenSeaNFT[] | undefined;
  const marketStats = data.marketStats as {
    totalEstimatedValue?: number;
    totalFloorValue?: number;
    uniqueCollections?: number;
    totalNFTs?: number;
    valuedNFTs?: number;
    scanComplete?: boolean;
    topCollectionsByValue?: Array<{
      name: string;
      count: number;
      floorPrice: number;
      totalValue: number;
    }>;
  } | undefined;
  const portfolioSummary = data.portfolioSummary as {
    totalValue?: number;
    currency?: string;
    valueSource?: string;
    isPartial?: boolean;
  } | undefined;
  const profileUrl = data.profileUrl as string | undefined;
  const source = data.source as string | undefined;
  const error = data.error as string | undefined;
  const valuationStatus = data.valuationStatus as 'available' | 'partial' | 'unavailable' | undefined;

  const getEstimatedValueUsd = (nft: OpenSeaNFT): number | undefined => {
    const candidate =
      typeof nft.estimatedValueUsd === 'number'
        ? nft.estimatedValueUsd
        : nft.currency === 'USD' && typeof nft.estimatedValue === 'number'
          ? nft.estimatedValue
          : undefined;
    return typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0
      ? candidate
      : undefined;
  };

  // Old cached payloads mixed unvalued discovery-order items into the ranked
  // list. Filter them client-side while schema v2 refreshes in the background.
  const topValuedNFTs = (rawTopValuedNFTs || [])
    .filter((nft) => getEstimatedValueUsd(nft) !== undefined)
    .slice(0, 8);
  const nftPreview = (
    rawNftPreview?.length
      ? rawNftPreview
      : (rawTopValuedNFTs || []).filter((nft) => getEstimatedValueUsd(nft) === undefined)
  ).slice(0, 8);
  const topCollectionsByValue = (marketStats?.topCollectionsByValue || [])
    .filter((collection) => Number.isFinite(collection.totalValue) && collection.totalValue > 0);
  const usesFloorProxy = topValuedNFTs.some(
    (nft) => (nft.valuationSource || nft.estimatedValueSource) === 'alchemy_opensea_collection_floor',
  );
  const usesDirectEstimate = topValuedNFTs.some(
    (nft) => (nft.valuationSource || nft.estimatedValueSource) === 'opensea_estimated_value_usd',
  );
  const aggregateUsesFloor =
    portfolioSummary?.valueSource === 'alchemy_opensea_collection_floor' ||
    portfolioSummary?.valueSource === 'mixed_direct_and_collection_floor';
  const valuationHeading = usesFloorProxy && !usesDirectEstimate
    ? 'Top NFTs by collection-floor proxy'
    : usesDirectEstimate && !usesFloorProxy
      ? 'Top NFTs by OpenSea estimate'
      : 'Top NFTs by available valuation';
  const portfolioHeading =
    portfolioSummary?.valueSource === 'alchemy_opensea_collection_floor'
      ? 'Scanned NFT collection-floor proxy:'
      : portfolioSummary?.valueSource === 'mixed_direct_and_collection_floor'
        ? 'Scanned NFT valuation proxy:'
        : 'Estimated scanned NFT value:';

  if (error === 'OPENSEA_API_KEY_REQUIRED' || error === 'API_INTEGRATION_PENDING') {
    return (
      <VStack gap={3} align="stretch">
        <Box p={3} bg="bg.info" borderRadius="md" border="1px solid" borderColor="border.info">
          <Text fontSize="sm" color="fg.info" fontWeight="semibold">
            {error === 'API_INTEGRATION_PENDING' ? 'Integration in Progress' : 'API Key Required'}
          </Text>
          <Text fontSize="xs" color="fg.info">
            {error === 'API_INTEGRATION_PENDING'
              ? 'Real OpenSea data integration is being implemented.'
              : 'Add OPENSEA_API_KEY to your environment to see real market data.'}
          </Text>
        </Box>
        <Link href={profileUrl || 'https://opensea.io'} target="_blank" rel="noopener noreferrer" color="blue.fg" fontSize="sm">
          Visit OpenSea ↗
        </Link>
      </VStack>
    );
  }

  return (
    <VStack gap={3} align="stretch">
      {portfolioSummary?.totalValue !== undefined && portfolioSummary.totalValue > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">{portfolioHeading}</Text>
          <HStack align="baseline" flexWrap="wrap">
            <Text fontSize="lg" fontWeight="bold" color="green.fg">
              {portfolioSummary.currency === 'USD'
                ? formatUsd(portfolioSummary.totalValue)
                : `${portfolioSummary.totalValue.toFixed(2)} ${portfolioSummary.currency || 'ETH'}`}
            </Text>
            {portfolioSummary.isPartial && (
              <Badge size="sm" variant="subtle">
                {marketStats?.scanComplete === false ? 'Partial scan' : 'Partial valuation'}
              </Badge>
            )}
          </HStack>
          <Text fontSize="xs" color="fg.muted">
            {aggregateUsesFloor
              ? 'Based on collection floors from Alchemy/OpenSea metadata'
              : 'Based on available item estimates'}
          </Text>
        </Box>
      )}

      {marketStats && (
        <HStack gap={4}>
          {marketStats.uniqueCollections !== undefined && (
            <Box>
              <Text fontSize="xs" color="fg.muted">Collections</Text>
              <Text fontSize="lg" fontWeight="bold" color="blue.fg">{marketStats.uniqueCollections}</Text>
            </Box>
          )}
          {marketStats.totalNFTs !== undefined && (
            <Box>
              <Text fontSize="xs" color="fg.muted">Scanned NFTs</Text>
              <Text fontSize="lg" fontWeight="bold" color="purple.fg">{marketStats.totalNFTs}</Text>
            </Box>
          )}
        </HStack>
      )}

      {topValuedNFTs.length > 0 && (
        <Box>
          <HStack justify="space-between" align="baseline" mb={2}>
            <Text fontSize="sm" fontWeight="semibold" color="fg">{valuationHeading}</Text>
            <Text fontSize="xs" color="fg.muted">Up to 8</Text>
          </HStack>
          <VStack gap={2} align="stretch">
            {topValuedNFTs.map((nft, index) => {
              const estimatedValueUsd = getEstimatedValueUsd(nft) as number;
              const valuationSource = nft.valuationSource || nft.estimatedValueSource;
              const estimateLabel = nft.valueLabel || (
                valuationSource === 'alchemy_opensea_collection_floor'
                  ? 'Collection floor proxy'
                  : 'OpenSea item estimate'
              );

              return (
              <Box
                key={`${nft.permalink || `${nft.collection}:${nft.name}`}:${index}`}
                p={2.5}
                bg="bg.muted"
                borderRadius="md"
                border="1px solid"
                borderColor="border"
              >
                <HStack gap={2.5} align="center">
                  <Text width="18px" flexShrink={0} fontSize="xs" color="fg.muted" textAlign="center">
                    {index + 1}
                  </Text>
                  {nft.image && (
                    <Box width="44px" height="44px" flexShrink={0} bg="bg.emphasized" borderRadius="md" overflow="hidden">
                      <Image src={nft.image} alt={nft.name} width={44} height={44} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Box>
                  )}
                  <VStack align="stretch" gap={0} flex={1} minW={0}>
                    <HStack justify="space-between" gap={2} align="baseline">
                      <Text fontSize="sm" fontWeight="semibold" color="fg" truncate>{nft.name}</Text>
                      <Text
                        fontSize="sm"
                        color="green.fg"
                        fontWeight="bold"
                        whiteSpace="nowrap"
                      >
                        {formatUsd(estimatedValueUsd)}
                      </Text>
                    </HStack>
                    <Text fontSize="xs" color="fg.muted" truncate>{nft.collection}</Text>
                    <HStack justify="space-between" gap={2} align="center" mt={0.5}>
                      <Text fontSize="xs" color="fg.muted" fontStyle="italic">
                        {estimateLabel}
                      </Text>
                      {nft.permalink && (
                        <Link href={nft.permalink} target="_blank" rel="noopener noreferrer" fontSize="xs" color="blue.fg">
                          View ↗
                        </Link>
                      )}
                    </HStack>
                  </VStack>
                  {nft.rarity && (
                    <Badge
                      size="sm"
                      colorScheme={nft.rarity === 'Ultra Rare' ? 'purple' : nft.rarity === 'Rare' ? 'blue' : 'gray'}
                      display={{ base: 'none', sm: 'inline-flex' }}
                    >
                      {nft.rarity}
                    </Badge>
                  )}
                </HStack>
              </Box>
              );
            })}
          </VStack>
          <Text fontSize="xs" color="fg.muted" mt={2}>
            {usesFloorProxy
              ? 'Collection floors are market proxies, not appraisals or guaranteed sale prices.'
              : 'Item values are estimates, not guaranteed sale prices.'}
          </Text>
          {(valuationStatus === 'partial' ||
            (marketStats?.valuedNFTs !== undefined &&
              marketStats?.totalNFTs !== undefined &&
              marketStats.valuedNFTs < marketStats.totalNFTs)) && (
            <Text fontSize="xs" color="fg.muted">
              Ranking includes only NFTs with usable valuation data.
            </Text>
          )}
        </Box>
      )}

      {topValuedNFTs.length === 0 && nftPreview.length > 0 && (
        <Box>
          <HStack justify="space-between" align="baseline" mb={2}>
            <Text fontSize="sm" fontWeight="semibold" color="fg">NFT holdings</Text>
            <Badge size="sm" variant="subtle">Valuation unavailable</Badge>
          </HStack>
          <VStack gap={2} align="stretch">
            {nftPreview.map((nft, index) => (
              <Box
                key={`${nft.permalink || `${nft.collection}:${nft.name}`}:${index}`}
                p={2.5}
                bg="bg.muted"
                borderRadius="md"
                border="1px solid"
                borderColor="border"
              >
                <HStack gap={2.5} align="center">
                  {nft.image && (
                    <Box width="44px" height="44px" flexShrink={0} bg="bg.emphasized" borderRadius="md" overflow="hidden">
                      <Image src={nft.image} alt={nft.name} width={44} height={44} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Box>
                  )}
                  <VStack align="stretch" gap={0} flex={1} minW={0}>
                    <Text fontSize="sm" fontWeight="semibold" color="fg" truncate>{nft.name}</Text>
                    <Text fontSize="xs" color="fg.muted" truncate>{nft.collection}</Text>
                  </VStack>
                  {nft.permalink && (
                    <Link href={nft.permalink} target="_blank" rel="noopener noreferrer" fontSize="xs" color="blue.fg">
                      View ↗
                    </Link>
                  )}
                </HStack>
              </Box>
            ))}
          </VStack>
          <Text fontSize="xs" color="fg.muted" mt={2}>
            These are holdings previews, not a value ranking.
          </Text>
        </Box>
      )}

      {topCollectionsByValue.length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">Top Collections by Available Proxy:</Text>
          <VStack gap={1} align="stretch">
            {topCollectionsByValue.slice(0, 3).map((collection, index) => (
              <HStack key={index} justify="space-between">
                <VStack align="start" gap={0}>
                  <Text fontSize="xs" fontWeight="semibold" color="fg" truncate>{collection.name}</Text>
                  <Text fontSize="xs" color="fg.muted">{collection.count} NFTs</Text>
                </VStack>
                <Text fontSize="xs" color="green.fg" fontWeight="semibold">
                  {formatUsd(collection.totalValue)}
                </Text>
              </HStack>
            ))}
          </VStack>
        </Box>
      )}

      <HStack justify="space-between" align="center">
        {source && source !== 'none' && (
          <Text fontSize="xs" color="fg.muted">
            Source: {aggregateUsesFloor || source === 'opensea+alchemy' ? 'OpenSea + Alchemy' : source}
          </Text>
        )}
        {profileUrl && (
          <Link href={profileUrl} target="_blank" rel="noopener noreferrer" color="blue.fg" fontSize="sm">
            View on OpenSea ↗
          </Link>
        )}
      </HStack>
    </VStack>
  );
};

const IcebreakerContent: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const displayName = data.displayName as string | undefined;
  const bio = data.bio as string | undefined;
  const verifiedChannelsCount = data.verifiedChannelsCount as number | undefined;
  const credentialsCount = data.credentialsCount as number | undefined;
  const profileUrl = data.profileUrl as string | undefined;

  return (
    <VStack gap={3} align="stretch">
      {displayName && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">Display Name:</Text>
          <Text fontSize="md" color="fg">{displayName}</Text>
        </Box>
      )}

      {bio && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">Bio:</Text>
          <Text fontSize="sm" color="fg" truncate>{bio}</Text>
        </Box>
      )}

      <HStack gap={4}>
        {verifiedChannelsCount !== undefined && (
          <Box>
            <Text fontSize="xs" color="fg.muted">Verified Channels</Text>
            <Text fontSize="lg" fontWeight="bold" color="green.fg">{verifiedChannelsCount}</Text>
          </Box>
        )}
        {credentialsCount !== undefined && (
          <Box>
            <Text fontSize="xs" color="fg.muted">Credentials</Text>
            <Text fontSize="lg" fontWeight="bold" color="blue.fg">{credentialsCount}</Text>
          </Box>
        )}
      </HStack>

      {profileUrl && (
        <Link href={profileUrl} target="_blank" rel="noopener noreferrer" color="green.fg" fontSize="sm">
          View on Icebreaker ↗
        </Link>
      )}
    </VStack>
  );
};

const HumanPassportContent: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const score = data.score as number | undefined;
  const trustLevel = data.trustLevel as string | undefined;
  const stamps = data.stamps as Array<{ provider: string; verified: boolean; category: string }> | undefined;
  const error = data.error as string | undefined;

  if (error === 'NO_API_ACCESS') {
    return (
      <VStack gap={3} align="stretch">
        <Box p={3} bg="bg.info" borderRadius="md" border="1px solid" borderColor="border.info">
          <Text fontSize="sm" color="fg.info" fontWeight="semibold">Educational Mode</Text>
          <Text fontSize="xs" color="fg.info">
            Human Passport (formerly Gitcoin Passport) helps verify your humanity and build reputation through various stamps and credentials.
          </Text>
        </Box>
        <Link href="https://passport.xyz" target="_blank" rel="noopener noreferrer" color="blue.fg" fontSize="sm">
          Learn about Human Passport ↗
        </Link>
      </VStack>
    );
  }

  return (
    <VStack gap={3} align="stretch">
      {score !== undefined && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">Trust Score:</Text>
          <HStack>
            <Text fontSize="lg" fontWeight="bold" color="blue.fg">{score.toFixed(1)}</Text>
            {trustLevel && (
              <Badge colorScheme={trustLevel === 'High' ? 'green' : trustLevel === 'Medium' ? 'yellow' : 'red'}>
                {trustLevel}
              </Badge>
            )}
          </HStack>
        </Box>
      )}

      {stamps && stamps.length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">Stamps ({stamps.length}):</Text>
          <VStack gap={1} align="stretch">
            {stamps.slice(0, 3).map((stamp, index) => (
              <HStack key={index} justify="space-between">
                <Text fontSize="sm" color="fg" truncate>{stamp.provider}</Text>
                <Badge colorScheme={stamp.verified ? 'green' : 'gray'} variant="subtle" fontSize="xs">
                  {stamp.verified ? 'Verified' : 'Unverified'}
                </Badge>
              </HStack>
            ))}
            {stamps.length > 3 && (
              <Text fontSize="xs" color="fg.muted">+{stamps.length - 3} more stamps</Text>
            )}
          </VStack>
        </Box>
      )}

      <Link href="https://passport.xyz" target="_blank" rel="noopener noreferrer" color="blue.fg" fontSize="sm">
        View on Human Passport ↗
      </Link>
    </VStack>
  );
};

const DecentralandContent: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const landParcels = data.landParcels as number | undefined;
  const wearables = data.wearables as number | undefined;
  const lastActive = data.lastActive as string | undefined;
  const profileUrl = data.profileUrl as string | undefined;

  return (
    <VStack gap={3} align="stretch">
      <HStack gap={4}>
        {landParcels !== undefined && (
          <Box>
            <Text fontSize="xs" color="fg.muted">LAND Parcels</Text>
            <Text fontSize="lg" fontWeight="bold" color="green.fg">{landParcels}</Text>
          </Box>
        )}
        {wearables !== undefined && (
          <Box>
            <Text fontSize="xs" color="fg.muted">Wearables</Text>
            <Text fontSize="lg" fontWeight="bold" color="purple.fg">{wearables}</Text>
          </Box>
        )}
      </HStack>

      {lastActive && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">Last Active:</Text>
          <Text fontSize="sm" color="fg">{new Date(lastActive).toLocaleDateString()}</Text>
        </Box>
      )}

      {profileUrl && (
        <Link href={profileUrl} target="_blank" rel="noopener noreferrer" color="green.fg" fontSize="sm">
          View in Decentraland ↗
        </Link>
      )}
    </VStack>
  );
};

const DeBankContent: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const totalUSD = data.totalUSD as number | undefined;
  const totalTokens = data.totalTokens as number | undefined;
  const totalProtocols = data.totalProtocols as number | undefined;
  const topTokens = data.topTokens as Array<{
    symbol: string;
    name: string;
    amount: number;
    usdValue: number;
    price: number;
    logoUrl?: string;
  }> | undefined;
  const protocolPositions = data.protocolPositions as Array<{
    name: string;
    category: string;
    usdValue: number;
    positionType: string;
    logoUrl?: string;
  }> | undefined;
  const portfolioUrl = data.portfolioUrl as string | undefined;
  const source = data.source as string | undefined;
  const error = data.error as string | undefined;
  if (error === 'API_INTEGRATION_PENDING' || error === 'NO_API_KEY') {
    return (
      <VStack gap={3} align="stretch">
        <Box p={3} bg="bg.info" borderRadius="md" border="1px solid" borderColor="border.info">
          <Text fontSize="sm" color="fg.info" fontWeight="semibold">
            {error === 'API_INTEGRATION_PENDING' ? 'Pending Integration' : 'API Key Required'}
          </Text>
          <Text fontSize="xs" color="fg.info">
            {error === 'API_INTEGRATION_PENDING'
              ? 'Real DeBank portfolio data integration is coming soon.'
              : 'Add DEBANK_API_KEY to your environment to see real portfolio usage.'}
          </Text>
        </Box>
        <Link href="https://debank.com" target="_blank" rel="noopener noreferrer" color="blue.fg" fontSize="sm">
          Visit DeBank ↗
        </Link>
      </VStack>
    );
  }

  return (
    <VStack gap={3} align="stretch">
      {totalUSD !== undefined && totalUSD > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">Portfolio Value:</Text>
          <Text fontSize="xl" fontWeight="bold" color="green.fg">
            ${totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </Box>
      )}

      <HStack gap={4}>
        {totalTokens !== undefined && (
          <Box>
            <Text fontSize="xs" color="fg.muted">Tokens</Text>
            <Text fontSize="lg" fontWeight="bold" color="blue.fg">{totalTokens}</Text>
          </Box>
        )}
        {totalProtocols !== undefined && (
          <Box>
            <Text fontSize="xs" color="fg.muted">DeFi Protocols</Text>
            <Text fontSize="lg" fontWeight="bold" color="purple.fg">{totalProtocols}</Text>
          </Box>
        )}
      </HStack>

      {topTokens && topTokens.length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">Top Holdings:</Text>
          <VStack gap={2} align="stretch">
            {topTokens.slice(0, 3).map((token, index) => (
              <Box key={index} p={2} bg="bg.muted" borderRadius="md" border="1px solid" borderColor="border">
                <HStack gap={2}>
                  {token.logoUrl && (
                    <Box width="20px" height="20px" bg="bg.emphasized" borderRadius="full" overflow="hidden">
                      <Image src={token.logoUrl} alt={token.symbol} width={20} height={20} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Box>
                  )}
                  <VStack align="start" gap={0} flex={1}>
                    <HStack justify="space-between" width="100%">
                      <Text fontSize="xs" fontWeight="semibold" color="fg">{token.symbol}</Text>
                      <Text fontSize="xs" color="green.fg" fontWeight="semibold">
                        ${token.usdValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </Text>
                    </HStack>
                    <Text fontSize="xs" color="fg.muted">
                      {token.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} @ ${token.price.toLocaleString()}
                    </Text>
                  </VStack>
                </HStack>
              </Box>
            ))}
            {topTokens.length > 3 && (
              <Text fontSize="xs" color="fg.muted" textAlign="center">+{topTokens.length - 3} more tokens</Text>
            )}
          </VStack>
        </Box>
      )}

      {protocolPositions && protocolPositions.length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">DeFi Positions:</Text>
          <VStack gap={1} align="stretch">
            {protocolPositions.slice(0, 3).map((position, index) => (
              <HStack key={index} justify="space-between">
                <HStack gap={2}>
                  {position.logoUrl && (
                    <Box width="16px" height="16px" bg="bg.emphasized" borderRadius="sm" overflow="hidden">
                      <Image src={position.logoUrl} alt={position.name} width={16} height={16} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Box>
                  )}
                  <VStack align="start" gap={0}>
                    <Text fontSize="xs" fontWeight="semibold" color="fg">{position.name}</Text>
                    <Badge size="xs" colorScheme={position.category === 'Lending' ? 'blue' : position.category === 'Staking' ? 'green' : 'purple'}>
                      {position.positionType}
                    </Badge>
                  </VStack>
                </HStack>
                <Text fontSize="xs" color="green.fg" fontWeight="semibold">
                  ${position.usdValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </Text>
              </HStack>
            ))}
            {protocolPositions.length > 3 && (
              <Text fontSize="xs" color="fg.muted" textAlign="center">+{protocolPositions.length - 3} more positions</Text>
            )}
          </VStack>
        </Box>
      )}

      <HStack justify="space-between" align="center">
        {source && source !== 'none' && (
          <Text fontSize="xs" color="fg.muted">Source: {source}</Text>
        )}
        {portfolioUrl && (
          <Link href={portfolioUrl} target="_blank" rel="noopener noreferrer" color="blue.fg" fontSize="sm">
            View on DeBank ↗
          </Link>
        )}
      </HStack>
    </VStack>
  );
};

const ZerionContent: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const totalUSD = data.totalUSD as number | undefined;
  const currency = data.currency as string | undefined;
  const profileUrl = data.profileUrl as string | undefined;
  const source = data.source as string | undefined;
  const error = data.error as string | undefined;

  if (error === 'NO_API_KEY') {
    return (
      <VStack gap={3} align="stretch">
        <Box p={3} bg="bg.info" borderRadius="md" border="1px solid" borderColor="border.info">
          <Text fontSize="sm" color="fg.info" fontWeight="semibold">API Key Required</Text>
          <Text fontSize="xs" color="fg.info">
            Add ZERION_API_KEY to your environment to fetch portfolio value and positions.
          </Text>
        </Box>
        <Link href="https://zerion.io/api" target="_blank" rel="noopener noreferrer" color="blue.fg" fontSize="sm">
          Learn about Zerion API ↗
        </Link>
      </VStack>
    );
  }

  return (
    <VStack gap={3} align="stretch">
      {totalUSD !== undefined && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">Portfolio Value:</Text>
          <Text fontSize="lg" fontWeight="bold" color="green.fg">
            ${Math.round(Number(totalUSD)).toLocaleString()} {currency || 'USD'}
          </Text>
        </Box>
      )}

      <HStack justify="space-between" align="center">
        {source && source !== 'none' && (
          <Text fontSize="xs" color="fg.muted">Source: {source}</Text>
        )}
      </HStack>

      {profileUrl && (
        <Link href={profileUrl} target="_blank" rel="noopener noreferrer" color="green.fg" fontSize="sm">
          View on Zerion ↗
        </Link>
      )}
    </VStack>
  );
};

const XMTPContent: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const inboxId = typeof data.inboxId === 'string' && data.inboxId.trim() ? data.inboxId : null;
  const profileAddress = typeof data.profileAddress === 'string' ? data.profileAddress : null;
  const identities = getXmtpIdentities(data, profileAddress);
  const environment = typeof data.env === 'string' ? data.env : null;
  const messageUrl = getXmtpMessageUrl(profileAddress, environment);
  const installationCount =
    typeof data.installationCount === 'number' && Number.isFinite(data.installationCount)
      ? Math.max(0, Math.trunc(data.installationCount))
      : null;

  const shortenIdentifier = (value: string, leading = 10, trailing = 6) =>
    value.length > leading + trailing + 1
      ? `${value.slice(0, leading)}…${value.slice(-trailing)}`
      : value;

  if (!inboxId) {
    return (
      <Text fontSize="sm" color="fg.muted">
        Not on XMTP.
      </Text>
    );
  }

  return (
    <VStack gap={2} align="stretch">
      <HStack justify="space-between" align="flex-start" gap={2} flexWrap="wrap">
        <VStack align="stretch" gap={0.5} minW={0}>
          <HStack gap={1.5} minW={0}>
            <Text fontSize="xs" fontWeight="semibold" color="fg.muted">Inbox</Text>
            <Text
              fontSize="xs"
              color="fg"
              fontFamily="mono"
              truncate
              title={inboxId}
            >
              {shortenIdentifier(inboxId, 8, 8)}
            </Text>
          </HStack>
          <HStack gap={1.5} flexWrap="wrap">
            {environment && (
              <Badge size="sm" colorScheme="blue" textTransform="capitalize">
                {environment}
              </Badge>
            )}
            {installationCount !== null && (
              <Text fontSize="xs" color="fg.muted">
                {installationCount} {installationCount === 1 ? 'install' : 'installs'}
              </Text>
            )}
            <Text fontSize="xs" color="fg.muted">
              {identities.length} {identities.length === 1 ? 'identity' : 'identities'}
            </Text>
          </HStack>
        </VStack>

        {messageUrl && (
          <Link
            data-testid="xmtp-message-link"
            href={messageUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Message on xmtp.im"
            display="inline-flex"
            alignItems="center"
            minH={{ base: '40px', md: '32px' }}
            px={2.5}
            borderRadius="md"
            border="1px solid"
            borderColor="border"
            color="blue.fg"
            fontSize="xs"
            fontWeight="semibold"
            whiteSpace="nowrap"
            _hover={{ bg: 'blue.subtle', textDecoration: 'none' }}
          >
            Message on xmtp.im ↗
          </Link>
        )}
      </HStack>

      {identities.length > 0 ? (
        <VStack
          gap={0}
          align="stretch"
          border="1px solid"
          borderColor="border"
          borderRadius="md"
          overflow="hidden"
        >
          {identities.map((identity, index) => {
            const identifierLabel = shortenIdentifier(
              identity.identifier,
              identity.kind === 'ethereum' ? 10 : 14,
              identity.kind === 'ethereum' ? 6 : 8,
            );

            return (
              <HStack
                key={`${identity.kind}:${identity.identifier.toLowerCase()}`}
                data-testid="xmtp-identity"
                data-identity-kind={identity.kind}
                justify="space-between"
                gap={2}
                px={2.5}
                py={{ base: 2, md: 1.5 }}
                minH={{ base: '40px', md: '34px' }}
                bg={identity.isViewedProfile ? 'green.subtle' : 'bg.muted'}
                borderBottom={index < identities.length - 1 ? '1px solid' : '0'}
                borderColor="border"
              >
                <HStack gap={1.5} minW={0} flex={1}>
                  <Badge
                    size="sm"
                    colorScheme={identity.kind === 'ethereum' ? 'blue' : identity.kind === 'passkey' ? 'purple' : 'gray'}
                    textTransform="uppercase"
                    flexShrink={0}
                  >
                    {identity.kind === 'ethereum' ? 'ETH' : identity.kind}
                  </Badge>
                  {identity.explorerUrl ? (
                    <Link
                      href={identity.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`View ${identity.identifier} on Etherscan`}
                      color="blue.fg"
                      fontSize="xs"
                      fontFamily="mono"
                      minW={0}
                      truncate
                      title={identity.identifier}
                    >
                      {identifierLabel} ↗
                    </Link>
                  ) : (
                    <Text
                      color="fg"
                      fontSize="xs"
                      fontFamily="mono"
                      minW={0}
                      truncate
                      title={identity.identifier}
                    >
                      {identifierLabel}
                    </Text>
                  )}
                </HStack>

                <HStack gap={1} flexShrink={0}>
                  {identity.isViewedProfile && (
                    <Badge size="sm" colorScheme="green">Profile</Badge>
                  )}
                  {identity.isRecovery && (
                    <Badge size="sm" colorScheme="purple">Recovery</Badge>
                  )}
                  {!identity.isViewedProfile && (
                    <Text fontSize="xs" color="fg.muted">Linked</Text>
                  )}
                </HStack>
              </HStack>
            );
          })}
        </VStack>
      ) : (
        <Text fontSize="sm" color="fg.muted">
          No inbox identities returned.
        </Text>
      )}
    </VStack>
  );
};

// Export individual fast service cards
export const FastENSCard: React.FC<{
  data: Record<string, unknown> | null;
  loading?: boolean;
  lastUpdated?: string | null;
  error?: { lastError: string; errorCount: number; lastAttempt: string } | null;
  onRefresh?: () => void;
}> = ({ data, loading, lastUpdated, error, onRefresh }) => (
  <ServiceCard data={data} loading={loading} serviceName="ENS" icon="🏷️" lastUpdated={lastUpdated} error={error} onRefresh={onRefresh} />
);

export const FastXMTPCard: React.FC<{
  data: Record<string, unknown> | null;
  loading?: boolean;
  lastUpdated?: string | null;
  error?: { lastError: string; errorCount: number; lastAttempt: string } | null;
  onRefresh?: () => void;
}> = ({ data, loading, lastUpdated, error, onRefresh }) => (
  <ServiceCard
    data={data}
    loading={loading}
    serviceName="XMTP"
    icon="✉️"
    description="Inbox identities and messaging"
    lastUpdated={lastUpdated}
    error={error}
    onRefresh={onRefresh}
  />
);

export const FastFarcasterCard: React.FC<{
  data: Record<string, unknown> | null;
  loading?: boolean;
  lastUpdated?: string | null;
  error?: { lastError: string; errorCount: number; lastAttempt: string } | null;
  onRefresh?: () => void;
}> = ({ data, loading, lastUpdated, error, onRefresh }) => (
  <ServiceCard data={data} loading={loading} serviceName="Farcaster" icon="🟣" lastUpdated={lastUpdated} error={error} onRefresh={onRefresh} />
);

export const FastAlchemyCard: React.FC<{
  data: Record<string, unknown> | null;
  loading?: boolean;
  lastUpdated?: string | null;
  error?: { lastError: string; errorCount: number; lastAttempt: string } | null;
  onRefresh?: () => void;
}> = ({ data, loading, lastUpdated, error, onRefresh }) => (
  <ServiceCard
    data={data}
    loading={loading}
    serviceName="Top Crypto Holdings"
    icon="🪙"
    description="Top fungible assets by USD value"
    lastUpdated={lastUpdated}
    error={error}
    onRefresh={onRefresh}
  />
);

export const FastOpenSeaCard: React.FC<{
  data: Record<string, unknown> | null;
  loading?: boolean;
  lastUpdated?: string | null;
  error?: { lastError: string; errorCount: number; lastAttempt: string } | null;
  onRefresh?: () => void;
}> = ({ data, loading, lastUpdated, error, onRefresh }) => (
  <ServiceCard data={data} loading={loading} serviceName="OpenSea" icon="🌊" lastUpdated={lastUpdated} error={error} onRefresh={onRefresh} />
);

export const FastIcebreakerCard: React.FC<{
  data: Record<string, unknown> | null;
  loading?: boolean;
  lastUpdated?: string | null;
  error?: { lastError: string; errorCount: number; lastAttempt: string } | null;
  onRefresh?: () => void;
}> = ({ data, loading, lastUpdated, error, onRefresh }) => (
  <ServiceCard data={data} loading={loading} serviceName="Icebreaker" icon="🧊" lastUpdated={lastUpdated} error={error} onRefresh={onRefresh} />
);

export const FastHumanPassportCard: React.FC<{
  data: Record<string, unknown> | null;
  loading?: boolean;
  lastUpdated?: string | null;
  error?: { lastError: string; errorCount: number; lastAttempt: string } | null;
  onRefresh?: () => void;
}> = ({ data, loading, lastUpdated, error, onRefresh }) => (
  <ServiceCard data={data} loading={loading} serviceName="Human Passport" icon="🎫" lastUpdated={lastUpdated} error={error} onRefresh={onRefresh} />
);

export const FastDecentralandCard: React.FC<{
  data: Record<string, unknown> | null;
  loading?: boolean;
  lastUpdated?: string | null;
  error?: { lastError: string; errorCount: number; lastAttempt: string } | null;
  onRefresh?: () => void;
}> = ({ data, loading, lastUpdated, error, onRefresh }) => (
  <ServiceCard data={data} loading={loading} serviceName="Decentraland" icon="🏗️" lastUpdated={lastUpdated} error={error} onRefresh={onRefresh} />
);

export const FastDeBankCard: React.FC<{
  data: Record<string, unknown> | null;
  loading?: boolean;
  lastUpdated?: string | null;
  error?: { lastError: string; errorCount: number; lastAttempt: string } | null;
  onRefresh?: () => void;
}> = ({ data, loading, lastUpdated, error, onRefresh }) => (
  <ServiceCard data={data} loading={loading} serviceName="DeBank" icon="💰" lastUpdated={lastUpdated} error={error} onRefresh={onRefresh} />
); 

export const FastZerionCard: React.FC<{
  data: Record<string, unknown> | null;
  loading?: boolean;
  lastUpdated?: string | null;
  error?: { lastError: string; errorCount: number; lastAttempt: string } | null;
  onRefresh?: () => void;
}> = ({ data, loading, lastUpdated, error, onRefresh }) => (
  <ServiceCard
    data={data}
    loading={loading}
    serviceName="Zerion"
    icon="📊"
    description="Portfolio value and positions"
    lastUpdated={lastUpdated}
    error={error}
    onRefresh={onRefresh}
  />
);
