import { useState } from 'react';
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
}

const prisma = new PrismaClient();
const ensClient = createEnsPublicClient({
  chain: mainnet,
  transport: http(),
});

export const getServerSideProps: GetServerSideProps<ProfilePageProps> = async (context) => {
  const ens_name = context.params?.ens as string;

  const fetchProfile = async (forceRefresh = false) => {
    try {
      console.log(`[DEBUG] Starting ENS resolution for: ${ens_name}`);
      const addressRecord = await ensClient.getAddressRecord({ name: ens_name });
      console.log(`[DEBUG] Raw ENS response:`, JSON.stringify(addressRecord, null, 2));

      // Check for valid ENS resolution first
      if (!addressRecord?.value || addressRecord.value === '0x0000000000000000000000000000000000000000') {
        console.log(`[DEBUG] ENS resolution failed for ${ens_name}`);
        // Clean up any existing invalid profile
        await prisma.cached_profiles.delete({
          where: { ens_name },
        }).catch(() => { });
        return null;
      }

      let profile = await prisma.cached_profiles.findUnique({
        where: { ens_name },
      });

      const now = new Date();

      if (forceRefresh || !profile || (profile.updated_at && new Date(profile.updated_at) < new Date(now.getTime() - 3600000))) {
        const avatarRecord = await ensClient.getTextRecord({ name: ens_name, key: 'avatar' });

        const profileData = {
          ens_name,
          address: addressRecord.value,
          profile_data: {
            ens_avatar: typeof avatarRecord === 'string' ? avatarRecord : null,
          },
          last_sync_status: `Successfully updated at ${now.toISOString()}`,
        };

        profile = await prisma.cached_profiles.upsert({
          where: { ens_name },
          update: { profile_data: JSON.stringify(profileData), updated_at: now, last_sync_status: profileData.last_sync_status },
          create: { ens_name, profile_data: JSON.stringify(profileData), updated_at: now, last_sync_status: profileData.last_sync_status },
        });
      }

      return JSON.parse(profile.profile_data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      // Clean up on error
      await prisma.cached_profiles.delete({
        where: { ens_name },
      }).catch(() => { });
      return null;
    }
  };

  const profile = await fetchProfile();

  return {
    props: {
      profile,
    },
  };
};

export default function ProfilePage({ profile }: ProfilePageProps) {
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