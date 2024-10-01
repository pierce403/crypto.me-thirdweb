import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';

interface Profile {
  ens_name: string;
  address: string;
  // Add more fields as you expand the profile data
}

export default function ProfilePage() {
  const router = useRouter();
  const { ens } = router.query;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ens) {
      fetchProfile(ens as string);
    }
  }, [ens]);

  const fetchProfile = async (ensName: string) => {
    try {
      const response = await fetch(`/api/profile?ens_name=${ensName}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      } else {
        console.error('Failed to fetch profile');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

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