import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const Home: React.FC = () => {
  const [health, setHealth] = useState<string>('');
  const [ensName, setEnsName] = useState<string>('');
  const router = useRouter();

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ensName) {
      router.push(`/${ensName}`);
    }
  };

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
          <h2 className="text-2xl font-semibold mb-4">View Profile</h2>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={ensName}
              onChange={(e) => setEnsName(e.target.value)}
              placeholder="Enter ENS name"
              className="border p-2 mr-2"
            />
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              View Profile
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default Home;
