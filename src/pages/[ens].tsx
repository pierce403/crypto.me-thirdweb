import { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { PrismaClient } from '@prisma/client';
import { createEnsPublicClient } from '@ensdomains/ensjs';
import { http } from 'viem';
import { mainnet } from 'viem/chains';
import { Box, Container, Heading, Text, VStack, Divider, useColorModeValue, Button } from '@chakra-ui/react';
import Image from 'next/image';

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
  needsRefresh?: boolean;
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
          needsRefresh: cachedProfile.updated_at < oneHourAgo
        },
      };
    }

    // If no cached profile, do the full ENS lookup
    const addressRecord = await ensClient.getAddressRecord({ name: ens_name });
    if (!addressRecord?.value || addressRecord.value === '0x0000000000000000000000000000000000000000') {
      return { props: { profile: null } };
    }

    // Rest of the profile creation logic...
  } catch (error) {
    console.error('Error fetching profile:', error);
    // Clean up on error
    await prisma.cached_profiles.delete({
      where: { ens_name },
    }).catch(() => { });
    return { props: { profile: null } };
  }
};

export default function ProfilePage({ profile, needsRefresh }: ProfilePageProps) {
  useEffect(() => {
    if (needsRefresh) {
      const timer = setTimeout(() => {
        window.location.reload();
      }, 10000); // 10 second delay
      return () => clearTimeout(timer);
    }
  }, [needsRefresh]);

  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const textColor = useColorModeValue('gray.800', 'gray.100');
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
        <Box p={8} mt={10} bg={bgColor} borderRadius="lg" boxShadow="md">
          <Text fontSize="xl" color={textColor}>Profile not found</Text>
        </Box>
      </Container>
    );
  }

  const address = typeof profile.address === 'string' ? profile.address : 'Address not available';

  // make sure ens_avatar starts with ipfs://
  const avatarUrl = profile.profile_data.ens_avatar && profile.profile_data.ens_avatar.startsWith('ipfs://') ? convertToGatewayUrl(profile.profile_data.ens_avatar) : null;

  return (
    <Container maxW="container.md" centerContent>
      <Head>
        <title>{profile.ens_name} | Crypto.me Profile</title>
      </Head>
      <Box p={8} mt={10} bg={bgColor} borderRadius="lg" boxShadow="md" width="100%">
        <VStack spacing={4} align="stretch">
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
          <Heading as="h1" size="2xl" color={textColor}>{profile.ens_name}</Heading>
          <Divider />
          <Box>
            <Text fontSize="lg" fontWeight="bold" color={textColor}>ENS Name:</Text>
            <Text fontSize="md" color={textColor}>{profile.ens_name}</Text>
          </Box>
          <Box>
            <Text fontSize="lg" fontWeight="bold" color={textColor}>ETH Address:</Text>
            <Text fontSize="md" color={textColor} wordBreak="break-all">{address}</Text>
          </Box>
          <Box>
            <Text fontSize="lg" fontWeight="bold" color={textColor}>Avatar:</Text>
            <Text fontSize="md" color={textColor}>{profile.profile_data.ens_avatar}</Text>
          </Box>
          <Box>
            <Text fontSize="lg" fontWeight="bold" color={textColor}>Last Sync Status:</Text>
            <Text fontSize="md" color={textColor}>{profile.last_sync_status || 'No sync status available'}</Text>
          </Box>
          <Button onClick={handleRefresh} isLoading={isRefreshing} loadingText="Refreshing">
            Refresh Profile
          </Button>
        </VStack>
      </Box>
    </Container>
  );
}