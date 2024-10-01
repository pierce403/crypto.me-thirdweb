import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { PrismaClient } from '@prisma/client';
import { createEnsPublicClient } from '@ensdomains/ensjs';
import { http } from 'viem';
import { mainnet } from 'viem/chains';

interface Profile {
  ens_name: string;
  address: string;
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

    if (!profile || new Date(profile.updated_at) < new Date(Date.now() - 3600000)) {
      const address = await ensClient.getAddress({ name: ens_name });
      const profileData = {
        ens_name,
        address: address || 'Address not found',
        // Add more fields as you expand the profile data
      };

      profile = await prisma.cached_profiles.upsert({
        where: { ens_name },
        update: { profile_data: profileData, updated_at: new Date() },
        create: { ens_name, profile_data: profileData },
      });
    }

    return {
      props: {
        profile: profile.profile_data as Profile,
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
  if (!profile) {
    return <div>Profile not found</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Head>
        <title>{profile.ens_name} | Crypto.me Profile</title>
      </Head>
      <h1 className="text-3xl font-bold mb-4">{profile.ens_name}</h1>
      <p className="mb-2">Address: {profile.address}</p>
      {/* Add more profile information here as you expand the data */}
    </div>
  );
}