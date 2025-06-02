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
  FastOpenSeaCard, 
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
    getCacheStats,
    hasAnyData,
    // Individual service data
    ens,
    farcaster,
    opensea,
    icebreaker,
    gitcoinPassport,
    decentraland,
  } = useFastProfile(address, {
    pollInterval: 30000, // Poll every 30 seconds
    initialPollDelay: 10000, // Wait 10s before first background update
    enablePolling: true,
  });

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

            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
              {/* Always show cards with data, never show loading state for individual cards since we have instant cache */}
              <FastENSCard data={ens} loading={false} />
              <FastFarcasterCard data={farcaster} loading={false} />
              <FastOpenSeaCard data={opensea} loading={false} />
              <FastIcebreakerCard data={icebreaker} loading={false} />
              <FastHumanPassportCard data={gitcoinPassport} loading={false} />
              <FastDecentralandCard data={decentraland} loading={false} />
            </SimpleGrid>
          </>
        )}
      </Box>
    </Container>
  );
}