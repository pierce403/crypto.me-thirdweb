/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { createEnsPublicClient } from '@ensdomains/ensjs';
import { http } from 'viem';
import { mainnet } from 'viem/chains';
import { Box, Container, Heading, Text, VStack, Separator, Button, SimpleGrid, HStack, Badge, Spinner } from '@chakra-ui/react';
import Image from 'next/image';
import { useFastProfile } from '../hooks/useFastProfile';
import {
  FastENSCard,
  FastFarcasterCard,
  FastAlchemyCard,
  FastOpenSeaCard,
  FastDeBankCard,
  FastIcebreakerCard,
  FastHumanPassportCard,
  FastDecentralandCard
} from '../components/FastServiceCards';

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

const ensClient = createEnsPublicClient({
  chain: mainnet,
  transport: http(),
});

export const getServerSideProps: GetServerSideProps<ProfilePageProps> = async (context) => {
  const ensName = context.params?.ens as string;

  try {
    // Do minimal ENS resolution for initial page load
    const addressRecord = await ensClient.getAddressRecord({ name: ensName });
    if (!addressRecord?.value || addressRecord.value === '0x0000000000000000000000000000000000000000') {
      return { props: { ensName, address: null, avatar: null } };
    }

    // Get basic avatar for initial render
    const avatarRecord = await ensClient.getTextRecord({ name: ensName, key: 'avatar' });
    const avatar = typeof avatarRecord === 'string' ? avatarRecord : null;

    return {
      props: {
        ensName,
        address: addressRecord.value,
        avatar,
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
    farcaster,
    alchemy,
    opensea,
    debank,
    icebreaker,
    gitcoinPassport,
    decentraland,
  } = useFastProfile(address, {
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

  if (!address) {
    return (
      <Container maxW="container.md" centerContent>
        <Head>
          <title>{ensName} | Crypto.me Profile</title>
        </Head>
        <Box p={8} mt={10} bg="gray.50" borderRadius="lg" boxShadow="md">
          <Text fontSize="xl" color="gray.800">ENS name &quot;{ensName}&quot; not found or has no address</Text>
        </Box>
      </Container>
    );
  }

  const avatarUrl = avatar ? convertToGatewayUrl(avatar) : null;
  const cacheStats = getCacheStats();

  // Only show loading when we have no data at all (not even cached data)
  const isInitialLoading = loading && !data;

  return (
    <Container maxW="container.xl" centerContent py={8}>
      <Head>
        <title>{ensName} | Crypto.me Profile</title>
      </Head>

      {/* Main Profile Header */}
      <Box p={8} mb={8} bg="gray.50" borderRadius="lg" boxShadow="md" width="100%" maxW="container.md">
        <VStack gap={4} align="stretch">
          {avatarUrl && (
            <Box alignSelf="center">
              <Image
                src={avatarUrl}
                alt={`${ensName} avatar`}
                width={150}
                height={150}
                style={{ borderRadius: '50%' }}
              />
            </Box>
          )}
          <Heading as="h1" size="2xl" color="gray.800" textAlign="center">{ensName}</Heading>
          <Separator />

          <Box>
            <Text fontSize="lg" fontWeight="bold" color="gray.800">ENS Name:</Text>
            <Text fontSize="md" color="gray.800">{ensName}</Text>
          </Box>

          <Box>
            <Text fontSize="lg" fontWeight="bold" color="gray.800">ETH Address:</Text>
            <Text fontSize="md" color="gray.800" wordBreak="break-all">{address}</Text>
          </Box>

          {avatar && (
            <Box>
              <Text fontSize="lg" fontWeight="bold" color="gray.800">Avatar:</Text>
              <Text fontSize="md" color="gray.800" wordBreak="break-all">{avatar}</Text>
            </Box>
          )}

          {/* Cache Status & Performance */}
          <Box>
            <Text fontSize="lg" fontWeight="bold" color="gray.800">Cache Status:</Text>
            <HStack gap={2} flexWrap="wrap">
              <Badge colorScheme={cacheStats.cacheStatus === 'hit' ? 'green' : 'yellow'}>
                {cacheStats.cacheStatus}
              </Badge>
              <Badge colorScheme="blue">
                {cacheStats.source}
              </Badge>
              <Badge colorScheme="purple">
                {cacheStats.loadTime}ms
              </Badge>
              {loading && <Spinner size="sm" />}
            </HStack>
            {cacheStats.lastUpdate && (
              <Text fontSize="sm" color="gray.600">
                Last updated: {new Date(cacheStats.lastUpdate).toLocaleString()}
              </Text>
            )}
          </Box>

          <Button
            onClick={handleRefresh}
            disabled={isRefreshing || isInitialLoading}
            colorScheme="blue"
          >
            {isRefreshing || isInitialLoading ? 'Refreshing...' : 'Refresh Profile'}
          </Button>

          {error && (
            <Box p={3} bg="red.50" borderRadius="md" border="1px solid" borderColor="red.200">
              <Text fontSize="sm" color="red.800">Error: {error}</Text>
            </Box>
          )}
        </VStack>
      </Box>

      {/* Service Cards */}
      <Box width="100%">
        <Heading as="h2" size="lg" color="gray.800" textAlign="center" mb={6}>
          Connected Services
        </Heading>

        {isInitialLoading ? (
          <Box p={6} bg="blue.50" borderRadius="lg" border="1px solid" borderColor="blue.200" mb={6}>
            <HStack justify="center" gap={3}>
              <Spinner size="sm" />
              <Text fontSize="sm" color="blue.800" textAlign="center">
                Loading profile data...
              </Text>
            </HStack>
          </Box>
        ) : (
          <>
            {!hasAnyData() && (
              <Box p={6} bg="yellow.50" borderRadius="lg" border="1px solid" borderColor="yellow.200" mb={6}>
                <Text fontSize="sm" color="yellow.800" textAlign="center">
                  🔄 Service data is being loaded in the background. This profile will update automatically as data becomes available.
                </Text>
              </Box>
            )}

            {/* Identity Summary */}
            {data && (
              <Box p={6} bg="white" borderRadius="lg" boxShadow="sm" mb={8} border="1px solid" borderColor="gray.100">
                <Heading as="h3" size="md" mb={4}>Identity Summary</Heading>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap={4}>
                  <Box>
                    <Text fontSize="sm" color="gray.500">ENS Names</Text>
                    <Text fontSize="xl" fontWeight="bold">
                      {(data.services.ens as any)?.domains?.length || 0}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="gray.500">Farcaster</Text>
                    <Text fontSize="xl" fontWeight="bold">
                      {(data.services.farcaster as any)?.username ? `@${(data.services.farcaster as any).username}` : '-'}
                    </Text>
                    {(data.services.farcaster as any)?.followerCount && (
                      <Text fontSize="xs" color="gray.400">{(data.services.farcaster as any).followerCount} followers</Text>
                    )}
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="gray.500">Gitcoin Passport</Text>
                    <Text fontSize="xl" fontWeight="bold">
                      {(data.services['gitcoin-passport'] as any)?.score ? Math.round(Number((data.services['gitcoin-passport'] as any).score) * 100) / 100 : '-'}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="gray.500">Net Worth (Est.)</Text>
                    <Text fontSize="xl" fontWeight="bold">
                      ${(data.services.debank as any)?.totalUSD ? Math.round(Number((data.services.debank as any).totalUSD)).toLocaleString() : '0'}
                    </Text>
                  </Box>
                </SimpleGrid>
              </Box>
            )}

            <VStack gap={8} align="stretch" width="100%">

              {/* Identity & Proofs */}
              <Box>
                <Heading as="h3" size="md" mb={4} color="gray.700" borderBottom="1px solid" borderColor="gray.200" pb={2}>
                  Identity & Proofs
                </Heading>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
                  <FastENSCard
                    data={ens}
                    loading={false}
                    lastUpdated={getServiceTimestamp('ens')}
                    error={getServiceError('ens')}
                    onRefresh={() => refreshService('ens')}
                  />
                  <FastHumanPassportCard
                    data={gitcoinPassport}
                    loading={false}
                    lastUpdated={getServiceTimestamp('gitcoin-passport')}
                    error={getServiceError('gitcoin-passport')}
                    onRefresh={() => refreshService('gitcoin-passport')}
                  />
                  <FastIcebreakerCard
                    data={icebreaker}
                    loading={false}
                    lastUpdated={getServiceTimestamp('icebreaker')}
                    error={getServiceError('icebreaker')}
                    onRefresh={() => refreshService('icebreaker')}
                  />
                </SimpleGrid>
              </Box>

              {/* Social */}
              <Box>
                <Heading as="h3" size="md" mb={4} color="gray.700" borderBottom="1px solid" borderColor="gray.200" pb={2}>
                  Social
                </Heading>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
                  <FastFarcasterCard
                    data={farcaster}
                    loading={false}
                    lastUpdated={getServiceTimestamp('farcaster')}
                    error={getServiceError('farcaster')}
                    onRefresh={() => refreshService('farcaster')}
                  />
                </SimpleGrid>
              </Box>

              {/* Assets */}
              <Box>
                <Heading as="h3" size="md" mb={4} color="gray.700" borderBottom="1px solid" borderColor="gray.200" pb={2}>
                  Assets
                </Heading>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
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
                </SimpleGrid>
              </Box>

              {/* Worlds / Metaverse */}
              <Box>
                <Heading as="h3" size="md" mb={4} color="gray.700" borderBottom="1px solid" borderColor="gray.200" pb={2}>
                  Worlds
                </Heading>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
                  <FastDecentralandCard
                    data={decentraland}
                    loading={false}
                    lastUpdated={getServiceTimestamp('decentraland')}
                    error={getServiceError('decentraland')}
                    onRefresh={() => refreshService('decentraland')}
                  />
                </SimpleGrid>
              </Box>

            </VStack>

          </>
        )}
      </Box>
    </Container>
  );
}