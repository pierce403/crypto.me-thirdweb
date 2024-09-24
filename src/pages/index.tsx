import React, { useState, useEffect } from 'react';
import Head from 'next/head';

interface Profile {
  name: string;
  bio: string;
  avatar: string;
  twitter: string;
  github: string;
  website: string;
}

const Home: React.FC = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [health, setHealth] = useState<string>('');
  const [ensName, setEnsName] = useState<string>('');

  const fetchProfile = async () => {
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
    }
  };

  const fetchHealth = async () => {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        const data = await response.json();
        setHealth(data.status);
      } else {
        console.error('Failed to fetch health status');
      }
    } catch (error) {
      console.error('Error fetching health status:', error);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <Head>
        <title>Crypto.me Profile</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <h1 className="text-4xl font-bold mb-8">Crypto.me Profile</h1>

        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Health Status</h2>
          <p className="text-lg">{health ? `Status: ${health}` : 'Loading...'}</p>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Fetch Profile</h2>
          <input
            type="text"
            value={ensName}
            onChange={(e) => setEnsName(e.target.value)}
            placeholder="Enter ENS name"
            className="border p-2 mr-2"
          />
          <button
            onClick={fetchProfile}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Fetch Profile
          </button>
        </div>

        {profile && (
          <div className="bg-gray-100 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Profile Information</h2>
            <img src={profile.avatar} alt="Avatar" className="w-32 h-32 rounded-full mb-4" />
            <p className="text-xl font-bold">{profile.name}</p>
            <p className="text-gray-600 mb-2">{profile.bio}</p>
            <p>Twitter: <a href={`https://twitter.com/${profile.twitter}`} className="text-blue-500">{profile.twitter}</a></p>
            <p>GitHub: <a href={`https://github.com/${profile.github}`} className="text-blue-500">{profile.github}</a></p>
            <p>Website: <a href={profile.website} className="text-blue-500">{profile.website}</a></p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Home;
