import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { PrismaClient } from '@prisma/client';
import { createEnsPublicClient } from '@ensdomains/ensjs';
import { http } from 'viem';
import { mainnet } from 'viem/chains';
import { Box, Container, Heading, Text, VStack, Divider, useColorModeValue } from '@chakra-ui/react';

interface Profile {
  ens_name: string;
  address: string;
  last_sync_status: string;
  // Add more fields as you expand the profile data
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
    let profile = await prisma.cached_profiles.findUnique({
      where: { ens_name },
    });

    const cacheExpiration = 3600000; // 1 hour in milliseconds
    const now = new Date();

    if (!profile || (profile.updated_at && new Date(profile.updated_at) < new Date(now.getTime() - cacheExpiration))) {
      let retries = 3;
      let addressRecord;

      while (retries > 0) {
        try {
          addressRecord = await ensClient.getAddressRecord({ name: ens_name });
          break;
        } catch (error) {
          console.error(`Error fetching address record (${retries} retries left):`, error);
          retries--;
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
        }
      }

      const profileData: Profile = {
        ens_name,
        address: addressRecord?.value || 'Address not found',
        last_sync_status: `Successfully updated at ${now.toISOString()}`,
        // Add more fields as you expand the profile data
      };

      console.log('Profile data before stringifying:', profileData);
      const stringifiedProfileData = JSON.stringify(profileData);
      console.log('Stringified profile data:', stringifiedProfileData);
      profile = await prisma.cached_profiles.upsert({
        where: { ens_name },
        update: { profile_data: stringifiedProfileData, updated_at: now, last_sync_status: profileData.last_sync_status },
        create: { ens_name, profile_data: stringifiedProfileData, updated_at: now, last_sync_status: profileData.last_sync_status },
      });
    }

    console.log('Raw profile_data:', profile.profile_data);
    let parsedProfile: Profile | null = null;
    try {
      if (typeof profile.profile_data === 'string') {
        parsedProfile = JSON.parse(profile.profile_data);
      } else if (typeof profile.profile_data === 'object') {
        parsedProfile = profile.profile_data as unknown as Profile;
      }

      if (parsedProfile && typeof parsedProfile === 'object' && 'address' in parsedProfile) {
        parsedProfile = parsedProfile as Profile;
        parsedProfile.last_sync_status = profile.last_sync_status || parsedProfile.last_sync_status || 'No sync status available';
      } else {
        console.error('Invalid profile data structure');
        parsedProfile = null;
      }
    } catch (parseError) {
      console.error('Error parsing profile data:', parseError);
    }

    // Ensure last_sync_status is always a string
    if (parsedProfile && typeof parsedProfile.last_sync_status !== 'string') {
      parsedProfile.last_sync_status = 'No sync status available';
    }

    return {
      props: {
        profile: parsedProfile,
      },
    };
  } catch (error) {
    console.error('Error fetching profile:', error);
    return {
      props: {
        profile: null,
      },
    };
  }
};

export default function ProfilePage({ profile }: ProfilePageProps) {
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const textColor = useColorModeValue('gray.800', 'gray.100');

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

  return (
    <Container maxW="container.md" centerContent>
      <Head>
        <title>{profile.ens_name} | Crypto.me Profile</title>
      </Head>
      <Box p={8} mt={10} bg={bgColor} borderRadius="lg" boxShadow="md" width="100%">
        <VStack spacing={4} align="stretch">
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
            <Text fontSize="lg" fontWeight="bold" color={textColor}>Last Sync Status:</Text>
            <Text fontSize="md" color={textColor}>{profile.last_sync_status || 'No sync status available'}</Text>
          </Box>
          {/* Add more profile information here as you expand the data */}
        </VStack>
      </Box>
    </Container>
  );
}
