/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, type ReactNode } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { Box, Container, Heading, Text, VStack, Separator, Button, SimpleGrid, HStack, Badge, Spinner, Grid, Flex, Link } from '@chakra-ui/react';
import Image from 'next/image';
import { useFastProfile } from '../hooks/useFastProfile';
import { withPrisma } from '../../lib/prisma';
import {
  FastENSCard,
  FastXMTPCard,
  FastFarcasterCard,
  FastAlchemyCard,
  FastOpenSeaCard,
  FastDeBankCard,
  FastZerionCard,
  FastIcebreakerCard,
  FastHumanPassportCard,
  FastDecentralandCard
} from '../components/FastServiceCards';
import { ColorModeToggle } from '../components/ColorMode';

// Add this function
function convertToGatewayUrl(ipfsUrl: string | null): string | null {
  if (!ipfsUrl) return null;
  const ipfsPrefix = 'ipfs://';
  if (ipfsUrl.startsWith(ipfsPrefix)) {
    const cid = ipfsUrl.substring(ipfsPrefix.length);
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
  }
  return ipfsUrl; // Return original URL if it's not an IPFS URL
}

interface ProfilePageProps {
  ensName: string;
  address: string | null;
  avatar: string | null;
}

interface ProfileApiResponse {
  error?: string;
  address?: string;
  profile_data?: { ens_avatar?: string | null };
}

function isEthereumAddress(input: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(input);
}

function isEnsName(input: string): boolean {
  return input.includes('.') && !input.startsWith('0x');
}

function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box
      as="section"
      bg="bg.panel"
      border="1px solid"
      borderColor="border"
      borderRadius="xl"
      boxShadow="sm"
      p={{ base: 4, md: 6 }}
    >
      <Heading as="h3" size="md" color="fg" mb={5}>
        {title}
      </Heading>
      {children}
    </Box>
  );
}

function ProfileHeader() {
  return (
    <Box as="header" bg="bg.panel" borderBottom="1px solid" borderColor="border" position="sticky" top={0} zIndex={20}>
      <Container maxW="1200px" py={2} px={{ base: 4, md: 6 }}>
        <HStack justify="space-between">
          <Link href="/" _hover={{ textDecoration: 'none' }}>
            <HStack gap={2}>
              <Flex width="34px" height="34px" borderRadius="md" bg="blue.600" color="white" align="center" justify="center" fontWeight="bold">
                c
              </Flex>
              <Text fontSize="lg" fontWeight="bold" color="fg">crypto.me</Text>
            </HStack>
          </Link>
          <HStack gap={2}>
            <Badge colorScheme="blue" variant="subtle" display={{ base: 'none', sm: 'inline-flex' }}>Web3 identity</Badge>
            <ColorModeToggle />
          </HStack>
        </HStack>
      </Container>
    </Box>
  );
}

export const getServerSideProps: GetServerSideProps<ProfilePageProps> = async (context) => {
  const ensName = context.params?.ens as string;

  // Cache SSR output briefly to reduce cold starts while keeping pages fresh.
  context.res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  // Support direct address input (homepage allows 0x... searches).
  if (isEthereumAddress(ensName)) {
    return { props: { ensName, address: ensName, avatar: null } };
  }

  try {
    // Fast path: return cached ENS data instantly if we have it.
    const cached = await withPrisma((prisma) => prisma.cached_profiles.findUnique({
      where: { ens_name: ensName },
      select: { profile_data: true },
    }));

    if (!cached?.profile_data) return { props: { ensName, address: null, avatar: null } };

    const parsed = JSON.parse(cached.profile_data) as { address?: string; profile_data?: { ens_avatar?: string | null } };
    const address = typeof parsed.address === 'string' ? parsed.address : null;
    const avatar = parsed.profile_data?.ens_avatar ?? null;

    return {
      props: {
        ensName,
        address,
        avatar: typeof avatar === 'string' ? avatar : null,
      },
    };

  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return {
      props: {
        ensName,
        address: null,
        avatar: null,
      },
    };
  }
};

export default function ProfilePage({ ensName, address, avatar }: ProfilePageProps) {
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(address);
  const [resolvedAvatar, setResolvedAvatar] = useState<string | null>(avatar);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // If we didn't get an address from SSR/cache, resolve it client-side (so the page can render immediately).
  useEffect(() => {
    let cancelled = false;

    async function resolveEns() {
      if (resolvedAddress) return;
      if (!ensName || isEthereumAddress(ensName)) return;

      setIsResolving(true);
      setResolveError(null);

      try {
        const response = await fetch(`/api/profile?ens_name=${encodeURIComponent(ensName)}`);
        const result = await response.json() as ProfileApiResponse;
        if (cancelled) return;

        if (!response.ok) {
          setResolveError(result?.error || 'Failed to resolve ENS name');
          setResolvedAddress(null);
          return;
        }

        setResolvedAddress(result?.address || null);
        setResolvedAvatar(result?.profile_data?.ens_avatar || null);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to resolve ENS name';
        setResolveError(message);
        setResolvedAddress(null);
      } finally {
        if (!cancelled) setIsResolving(false);
      }
    }

    resolveEns();
    return () => {
      cancelled = true;
    };
  }, [ensName, resolvedAddress]);

  // Use the fast profile hook for instant loading
  const {
    data,
    loading,
    error,
    refresh,
    refreshService,
    getCacheStats,
    hasAnyData,
    getServiceTimestamp,
    getServiceError,
    // Individual service data
    ens,
    xmtp,
    farcaster,
    alchemy,
    opensea,
    debank,
    zerion,
    icebreaker,
    gitcoinPassport,
    decentraland,
  } = useFastProfile(resolvedAddress, {
    pollInterval: 30000, // Poll every 30 seconds
    initialPollDelay: 10000, // Wait 10s before first background update
    enablePolling: true,
  }, ensName);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    refresh();
    // Give some visual feedback
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  if (!resolvedAddress) {
    return (
      <Box minH="100vh" bg="bg.subtle" color="fg" _dark={{ bg: 'bg' }}>
        <Head>
          <title>{`${ensName} | Crypto.me Profile`}</title>
        </Head>
        <ProfileHeader />
        <Container maxW="container.md" centerContent>
          <Box p={8} mt={10} bg="bg.panel" border="1px solid" borderColor="border" borderRadius="lg" boxShadow="md">
            <VStack gap={3} align="stretch">
              <Heading as="h1" size="lg" color="fg" textAlign="center">{ensName}</Heading>
              <Separator />
              {isResolving ? (
                <HStack justify="center" gap={3}>
                  <Spinner size="sm" />
                  <Text fontSize="md" color="fg.muted">Resolving ENS name…</Text>
                </HStack>
              ) : (
                <Text fontSize="md" color="fg" textAlign="center">
                  {resolveError
                    ? `Could not resolve ENS name: ${resolveError}`
                    : `ENS name "${ensName}" not found or has no address`}
                </Text>
              )}
              {!isResolving && (
                <Button onClick={() => window.location.reload()} colorScheme="blue" variant="outline">
                  Try Again
                </Button>
              )}
            </VStack>
          </Box>
        </Container>
      </Box>
    );
  }

  const avatarUrl = resolvedAvatar ? convertToGatewayUrl(resolvedAvatar) : null;
  const cacheStats = getCacheStats();
  const ensNamesCount = (() => {
    const ensData = (data?.services?.ens as any) ?? null;
    if (!ensData) return 0;

    const names = new Set<string>();
    const primaryName = ensData.primaryName;
    if (typeof primaryName === 'string' && primaryName.includes('.') && !primaryName.startsWith('0x')) {
      names.add(primaryName);
    }

    const otherNames = ensData.otherNames;
    if (Array.isArray(otherNames)) {
      for (const name of otherNames) {
        if (typeof name === 'string') names.add(name);
      }
    }

    return names.size;
  })();
  const netWorthUsd = (() => {
    const zerionData = (data?.services?.zerion as any) ?? null;
    if (zerionData && zerionData.source === 'zerion' && typeof zerionData.totalUSD === 'number') return zerionData.totalUSD;

    const debankData = (data?.services?.debank as any) ?? null;
    if (debankData && debankData.source === 'debank' && typeof debankData.totalUSD === 'number') return debankData.totalUSD;

    return null;
  })();
  const xmtpCardData = xmtp ? { ...xmtp, profileAddress: resolvedAddress } : xmtp;

  // Only show loading when we have no data at all (not even cached data)
  const isInitialLoading = loading && !data;

  return (
    <Box data-testid="profile-shell" minH="100vh" bg="bg.subtle" color="fg" _dark={{ bg: 'bg' }}>
      <Head>
        <title>{`${ensName} | Crypto.me Profile`}</title>
      </Head>

      <ProfileHeader />

      <Container maxW="1200px" py={{ base: 4, lg: 6 }} px={{ base: 3, md: 6 }}>
        <Grid
          data-testid="profile-layout"
          templateColumns={{ base: 'minmax(0, 1fr)', lg: '280px minmax(0, 1fr)' }}
          gap={6}
          alignItems="start"
        >
          <Box
            data-testid="profile-sidebar"
            position={{ base: 'static', lg: 'sticky' }}
            top={{ lg: '76px' }}
          >
            <Box bg="bg.panel" border="1px solid" borderColor="border" borderRadius="xl" boxShadow="sm" overflow="hidden">
              <Box height={{ base: '96px', lg: '76px' }} background="linear-gradient(120deg, #0a66c2 0%, #4f46e5 58%, #7c3aed 100%)" />
              <VStack align="stretch" gap={4} px={5} pb={5} mt="-52px">
                <Box
                  alignSelf="center"
                  width="112px"
                  height="112px"
                  borderRadius="full"
                  border="4px solid"
                  borderColor="bg.panel"
                  bg="blue.subtle"
                  overflow="hidden"
                  boxShadow="sm"
                >
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={`${ensName} avatar`}
                      width={112}
                      height={112}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <Flex width="100%" height="100%" align="center" justify="center">
                      <Text fontSize="4xl" fontWeight="bold" color="blue.fg">
                        {isEnsName(ensName) ? ensName.charAt(0).toUpperCase() : 'Ξ'}
                      </Text>
                    </Flex>
                  )}
                </Box>

                <VStack gap={1} textAlign="center">
                  <Heading as="h1" size="lg" color="fg" wordBreak="break-word">{ensName}</Heading>
                  <Text fontSize="xs" color="fg.muted" fontFamily="mono" wordBreak="break-all" title={resolvedAddress}>
                    {resolvedAddress}
                  </Text>
                  <Badge colorScheme="blue" variant="subtle">
                    {isEnsName(ensName) ? 'ENS profile' : 'Ethereum profile'}
                  </Badge>
                </VStack>

                <Separator />

                <Box>
                  <Text fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="wide" fontWeight="semibold" mb={2}>
                    Profile status
                  </Text>
                  <HStack gap={2} flexWrap="wrap">
                    <Badge colorScheme={cacheStats.cacheStatus === 'hit' ? 'green' : 'yellow'}>
                      {cacheStats.cacheStatus}
                    </Badge>
                    <Badge colorScheme="blue">{cacheStats.source}</Badge>
                    <Badge colorScheme="purple">{cacheStats.loadTime}ms</Badge>
                    {loading && <Spinner size="sm" />}
                  </HStack>
                  {cacheStats.lastUpdate && (
                    <Text fontSize="xs" color="fg.muted" mt={2}>
                      Updated {new Date(cacheStats.lastUpdate).toLocaleString()}
                    </Text>
                  )}
                </Box>

                <Button
                  onClick={handleRefresh}
                  disabled={isRefreshing || isInitialLoading}
                  colorScheme="blue"
                  width="full"
                >
                  {isRefreshing || isInitialLoading ? 'Refreshing...' : 'Refresh Profile'}
                </Button>

                {error && (
                  <Box p={3} bg="bg.error" borderRadius="md" border="1px solid" borderColor="border.error">
                    <Text fontSize="sm" color="fg.error">Error: {error}</Text>
                  </Box>
                )}
              </VStack>
            </Box>
          </Box>

          <Box data-testid="profile-main" minW={0}>
            <HStack justify="space-between" align="start" mb={4} px={1}>
              <Box>
                <Heading as="h2" size="lg" color="fg">Connected Services</Heading>
                <Text fontSize="sm" color="fg.muted" mt={1}>On-chain identity, social graph, assets, and reputation.</Text>
              </Box>
            </HStack>

            {isInitialLoading ? (
              <Box p={6} bg="bg.info" borderRadius="xl" border="1px solid" borderColor="border.info">
                <HStack justify="center" gap={3}>
                  <Spinner size="sm" />
                  <Text fontSize="sm" color="fg.info" textAlign="center">Loading profile data...</Text>
                </HStack>
              </Box>
            ) : (
              <VStack gap={4} align="stretch" width="100%">
                {!hasAnyData() && (
                  <Box p={5} bg="bg.warning" borderRadius="xl" border="1px solid" borderColor="border.warning">
                    <Text fontSize="sm" color="fg.warning" textAlign="center">
                      🔄 Service data is being loaded in the background. This profile will update automatically as data becomes available.
                    </Text>
                  </Box>
                )}

                {data && (
                  <ProfileSection title="Identity Summary">
                    <SimpleGrid columns={{ base: 1, sm: 2, md: 4, lg: 2, xl: 4 }} gap={4}>
                      <Box>
                        <Text fontSize="sm" color="fg.muted">ENS Names</Text>
                        <Text fontSize="xl" fontWeight="bold">{ensNamesCount}</Text>
                      </Box>
                      <Box minW={0}>
                        <Text fontSize="sm" color="fg.muted">Farcaster</Text>
                        <Text fontSize="xl" fontWeight="bold" truncate>
                          {(data.services.farcaster as any)?.username ? `@${(data.services.farcaster as any).username}` : '-'}
                        </Text>
                        {(data.services.farcaster as any)?.followerCount && (
                          <Text fontSize="xs" color="fg.muted">{(data.services.farcaster as any).followerCount} followers</Text>
                        )}
                      </Box>
                      <Box>
                        <Text fontSize="sm" color="fg.muted">Gitcoin Passport</Text>
                        <Text fontSize="xl" fontWeight="bold">
                          {(data.services['gitcoin-passport'] as any)?.score ? Math.round(Number((data.services['gitcoin-passport'] as any).score) * 100) / 100 : '-'}
                        </Text>
                      </Box>
                      <Box>
                        <Text fontSize="sm" color="fg.muted">Net Worth (Est.)</Text>
                        <Text fontSize="xl" fontWeight="bold">
                          {netWorthUsd === null ? '—' : `$${Math.round(Number(netWorthUsd)).toLocaleString()}`}
                        </Text>
                      </Box>
                    </SimpleGrid>
                  </ProfileSection>
                )}

                <ProfileSection title="Identity & Proofs">
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={5}>
                    <FastFarcasterCard
                      data={farcaster}
                      loading={false}
                      lastUpdated={getServiceTimestamp('farcaster')}
                      error={getServiceError('farcaster')}
                      onRefresh={() => refreshService('farcaster')}
                    />
                    <FastENSCard
                      data={ens}
                      loading={false}
                      lastUpdated={getServiceTimestamp('ens')}
                      error={getServiceError('ens')}
                      onRefresh={() => refreshService('ens')}
                    />
                    <FastIcebreakerCard
                      data={icebreaker}
                      loading={false}
                      lastUpdated={getServiceTimestamp('icebreaker')}
                      error={getServiceError('icebreaker')}
                      onRefresh={() => refreshService('icebreaker')}
                    />
                  </SimpleGrid>
                </ProfileSection>

                <ProfileSection title="Messaging">
                  <FastXMTPCard
                    data={xmtpCardData}
                    loading={false}
                    lastUpdated={getServiceTimestamp('xmtp')}
                    error={getServiceError('xmtp')}
                    onRefresh={() => refreshService('xmtp')}
                  />
                </ProfileSection>

                <ProfileSection title="Assets & Portfolio">
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={5}>
                    <FastAlchemyCard
                      data={alchemy}
                      loading={false}
                      lastUpdated={getServiceTimestamp('alchemy')}
                      error={getServiceError('alchemy')}
                      onRefresh={() => refreshService('alchemy')}
                    />
                    <FastOpenSeaCard
                      data={opensea}
                      loading={false}
                      lastUpdated={getServiceTimestamp('opensea')}
                      error={getServiceError('opensea')}
                      onRefresh={() => refreshService('opensea')}
                    />
                    <FastDeBankCard
                      data={debank}
                      loading={false}
                      lastUpdated={getServiceTimestamp('debank')}
                      error={getServiceError('debank')}
                      onRefresh={() => refreshService('debank')}
                    />
                    <FastZerionCard
                      data={zerion}
                      loading={false}
                      lastUpdated={getServiceTimestamp('zerion')}
                      error={getServiceError('zerion')}
                      onRefresh={() => refreshService('zerion')}
                    />
                  </SimpleGrid>
                </ProfileSection>

                <ProfileSection title="Reputation & Worlds">
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={5}>
                    <FastHumanPassportCard
                      data={gitcoinPassport}
                      loading={false}
                      lastUpdated={getServiceTimestamp('gitcoin-passport')}
                      error={getServiceError('gitcoin-passport')}
                      onRefresh={() => refreshService('gitcoin-passport')}
                    />
                    <FastDecentralandCard
                      data={decentraland}
                      loading={false}
                      lastUpdated={getServiceTimestamp('decentraland')}
                      error={getServiceError('decentraland')}
                      onRefresh={() => refreshService('decentraland')}
                    />
                  </SimpleGrid>
                </ProfileSection>
              </VStack>
            )}
          </Box>
        </Grid>
      </Container>
    </Box>
  );
}
