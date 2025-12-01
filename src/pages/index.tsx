import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Box, Container, Heading, Input, Button, VStack, HStack, Link } from '@chakra-ui/react';

import { ens_normalize } from '@adraffy/ens-normalize';

// Function to validate if a string is a valid ENS name or address
const isValidENSName = (name: string): boolean => {
  if (!name || typeof name !== 'string') return false;

  // Allow Ethereum addresses
  if (/^0x[a-fA-F0-9]{40}$/i.test(name)) return true;

  try {
    // Use standard normalization
    const normalized = ens_normalize(name);
    // Must contain a dot to be a domain
    return normalized.includes('.');
  } catch {
    return false;
  }
};

const Home: React.FC = () => {
  //const [health, setHealth] = useState<string>('');
  const [ensName, setEnsName] = useState<string>('');
  const [recentProfiles, setRecentProfiles] = useState<string[]>([]);
  const router = useRouter();

  const fetchRecentProfiles = async () => {
    try {
      const response = await fetch('/api/recent-profiles');
      if (response.ok) {
        const data = await response.json();
        // Filter to only show valid ENS names
        const validProfiles = data.profiles.filter(isValidENSName);
        setRecentProfiles(validProfiles);
      } else {
        console.error('Failed to fetch recent profiles');
      }
    } catch (error) {
      console.error('Error fetching recent profiles:', error);
    }
  };

  useEffect(() => {
    //fetchHealth();
    fetchRecentProfiles();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ensName) {
      router.push(`/${ensName}`);
    }
  };

  return (
    <Container maxW="container.md" py={16} centerContent>
      <Head>
        <title>Crypto.me Profile</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <VStack gap={8} align="center">
        <Heading as="h1" size="2xl" textAlign="center">crypto.me</Heading>

        <Box width="100%">
          <form onSubmit={handleSubmit}>
            <HStack justify="center">
              <Input
                width="60%"
                type="text"
                value={ensName}
                onChange={(e) => setEnsName(e.target.value)}
                placeholder="Enter ENS name"
                size="lg"
              />
              <Button type="submit" colorPalette="blue" size="lg">
                View Profile
              </Button>
            </HStack>
          </form>
        </Box>

        {recentProfiles.length > 0 && (
          <Box width="100%" mt={8}>
            <Heading as="h2" size="lg" textAlign="center">Recently Updated Profiles</Heading>
            <VStack gap={2} mt={4}>
              {recentProfiles.map((profile, index) => (
                <Box key={index} textAlign="center">
                  <Link href={`/${profile}`} color="blue.500" fontSize="lg">
                    {profile}
                  </Link>
                </Box>
              ))}
            </VStack>
          </Box>
        )}
      </VStack>
    </Container>
  );
};

export default Home;
