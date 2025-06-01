import { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { PrismaClient } from '@prisma/client';
import { createEnsPublicClient } from '@ensdomains/ensjs';
import { http } from 'viem';
import { mainnet } from 'viem/chains';
import { Box, Container, Heading, Text, VStack, Separator, Button, SimpleGrid } from '@chakra-ui/react';
import Image from 'next/image';
import { ENSCard, IcebreakerCard, FarcasterCard, OpenSeaCard, DecentralandCard, GitcoinPassportCard } from '../components/ServiceCards';

// Add this function
function convertToGatewayUrl(ipfsUrl: string | null): string | null {
  if (!ipfsUrl) return null;
  const ipfsPrefix = 'ipfs://';
  if (ipfsUrl.startsWith(ipfsPrefix)) {
    const cid = ipfsUrl.slice(ipfsPrefix.length);
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
  }
  return ipfsUrl; // Return original URL if it's not an IPFS URL
}

interface Profile {
  ens_name: string;
  address: string;
  last_sync_status: string;
  profile_data: {
    ens_avatar: string | null;
    // Add more fields as you expand the profile data
  };
}

interface ProfilePageProps {
  profile: Profile | null;
}

const prisma = new PrismaClient();
const ensClient = createEnsPublicClient({
  chain: mainnet,
  transport: http(),
});

export const getServerSideProps: GetServerSideProps<ProfilePageProps> = async (context) => {
  const ens_name = context.params?.ens as string;

  try {
    // Immediately try to get cached profile
    const cachedProfile = await prisma.cached_profiles.findUnique({
      where: { ens_name },
    });

    // If we have a cached profile, return it immediately
    if (cachedProfile) {
      // Start background refresh if profile is older than 1 hour
      const oneHourAgo = new Date(Date.now() - 3600000);
      if (cachedProfile.updated_at < oneHourAgo) {
        // Fire and forget the refresh
        fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/profile?ens_name=${ens_name}&refresh=true`)
          .catch(console.error);
      }
      
      return {
        props: {
          profile: JSON.parse(cachedProfile.profile_data),
        },
      };
    }

    // If no cached profile, do the full ENS lookup
    const addressRecord = await ensClient.getAddressRecord({ name: ens_name });
    if (!addressRecord?.value || addressRecord.value === '0x0000000000000000000000000000000000000000') {
      return { props: { profile: null } };
    }

    // Create initial profile
    const avatarRecord = await ensClient.getTextRecord({ name: ens_name, key: 'avatar' });
    const avatar = typeof avatarRecord === 'string' ? avatarRecord : null;

    const profileData = {
      ens_name,
      address: addressRecord.value,
      profile_data: {
        ens_avatar: avatar,
      },
      last_sync_status: `Successfully updated at ${new Date().toISOString()}`,
    };

    const profile = await prisma.cached_profiles.create({
      data: {
        ens_name,
        profile_data: JSON.stringify(profileData),
        last_sync_status: profileData.last_sync_status
      },
    });

    return {
      props: {
        profile: JSON.parse(profile.profile_data),
      },
    };

  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return {
      props: {
        profile: null,
      },
    };
  }
};

export default function ProfilePage({ profile }: ProfilePageProps) {
  useEffect(() => {
    // Existing useEffect logic can be removed or adapted if it's no longer needed.
    // For now, let's keep it commented out to show where it was.
    // if (needsRefresh) {
    //   const timer = setTimeout(() => {
    //     window.location.reload();
    //   }, 10000); // 10 second delay
    //   return () => clearTimeout(timer);
    // }
  }, []); // Adjusted dependencies if needsRefresh is removed

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/profile?ens_name=${profile?.ens_name}&refresh=true`);
      if (response.ok) {
        window.location.reload(); // Reload the page to show updated data
      } else {
        console.error('Failed to refresh profile');
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
    setIsRefreshing(false);
  };

  if (!profile) {
    return (
      <Container maxW="container.md" centerContent>
        <Box p={8} mt={10} bg="gray.50" borderRadius="lg" boxShadow="md">
          <Text fontSize="xl" color="gray.800">Profile not found</Text>
        </Box>
      </Container>
    );
  }

  const address = typeof profile.address === 'string' ? profile.address : 'Address not available';

  // make sure ens_avatar starts with ipfs://
  const avatarUrl = profile.profile_data.ens_avatar && profile.profile_data.ens_avatar.startsWith('ipfs://') ? convertToGatewayUrl(profile.profile_data.ens_avatar) : null;

  return (
    <Container maxW="container.xl" centerContent py={8}>
      <Head>
        <title>{profile.ens_name} | Crypto.me Profile</title>
      </Head>
      
      {/* Main Profile Header */}
      <Box p={8} mb={8} bg="gray.50" borderRadius="lg" boxShadow="md" width="100%" maxW="container.md">
        <VStack gap={4} align="stretch">
          {avatarUrl && (
            <Box alignSelf="center">
              <Image
                src={avatarUrl}
                alt={`${profile.ens_name} avatar`}
                width={150}
                height={150}
                style={{ borderRadius: '50%' }}
              />
            </Box>
          )}
          <Heading as="h1" size="2xl" color="gray.800" textAlign="center">{profile.ens_name}</Heading>
          <Separator />
          <Box>
            <Text fontSize="lg" fontWeight="bold" color="gray.800">ENS Name:</Text>
            <Text fontSize="md" color="gray.800">{profile.ens_name}</Text>
          </Box>
          <Box>
            <Text fontSize="lg" fontWeight="bold" color="gray.800">ETH Address:</Text>
            <Text fontSize="md" color="gray.800" wordBreak="break-all">{address}</Text>
          </Box>
          <Box>
            <Text fontSize="lg" fontWeight="bold" color="gray.800">Avatar:</Text>
            <Text fontSize="md" color="gray.800">{profile.profile_data.ens_avatar}</Text>
          </Box>
          <Box>
            <Text fontSize="lg" fontWeight="bold" color="gray.800">Last Sync Status:</Text>
            <Text fontSize="md" color="gray.800">{profile.last_sync_status || 'No sync status available'}</Text>
          </Box>
          <Button onClick={handleRefresh} loading={isRefreshing}>
            Refresh Profile
          </Button>
        </VStack>
      </Box>

      {/* Service Cards */}
      <Box width="100%">
        <Heading as="h2" size="lg" color="gray.800" textAlign="center" mb={6}>
          Connected Services
        </Heading>
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
          <ENSCard address={address} ensName={profile.ens_name} />
          <IcebreakerCard address={address} ensName={profile.ens_name} />
          <FarcasterCard address={address} ensName={profile.ens_name} />
          <OpenSeaCard address={address} ensName={profile.ens_name} />
          <DecentralandCard address={address} ensName={profile.ens_name} />
          <GitcoinPassportCard address={address} ensName={profile.ens_name} />
        </SimpleGrid>
      </Box>
    </Container>
  );
}