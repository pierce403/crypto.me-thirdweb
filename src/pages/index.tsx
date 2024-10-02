import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Box, Container, Heading, Text, Input, Button, VStack, HStack, Link, UnorderedList, ListItem } from '@chakra-ui/react';

const Home: React.FC = () => {
  const [health, setHealth] = useState<string>('');
  const [ensName, setEnsName] = useState<string>('');
  const [recentProfiles, setRecentProfiles] = useState<string[]>([]);
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

  const fetchRecentProfiles = async () => {
    try {
      const response = await fetch('/api/recent-profiles');
      if (response.ok) {
        const data = await response.json();
        setRecentProfiles(data.profiles);
      } else {
        console.error('Failed to fetch recent profiles');
      }
    } catch (error) {
      console.error('Error fetching recent profiles:', error);
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchRecentProfiles();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ensName) {
      router.push(`/${ensName}`);
    }
  };

  return (
    <Container maxW="container.xl" py={8}>
      <Head>
        <title>Crypto.me Profile</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <VStack spacing={8} align="stretch">
        <Heading as="h1" size="2xl">Crypto.me Profile</Heading>

        <Box>
          <Heading as="h2" size="lg" mb={2}>About Crypto.me</Heading>
          <Text>
            Crypto.me is a central profile page for web3 identities. It allows you to view and manage your decentralized identity across various blockchain networks.
          </Text>
        </Box>

        <Box>
          <Heading as="h2" size="lg" mb={2}>Health Status</Heading>
          <Text>{health ? `Status: ${health}` : 'Loading...'}</Text>
        </Box>

        <Box>
          <Heading as="h2" size="lg" mb={2}>View Profile</Heading>
          <form onSubmit={handleSubmit}>
            <HStack>
              <Input
                type="text"
                value={ensName}
                onChange={(e) => setEnsName(e.target.value)}
                placeholder="Enter ENS name"
              />
              <Button type="submit" colorScheme="blue">
                View Profile
              </Button>
            </HStack>
          </form>
        </Box>

        <Box>
          <Heading as="h2" size="lg" mb={2}>Recently Updated Profiles</Heading>
          <UnorderedList>
            {recentProfiles.map((profile, index) => (
              <ListItem key={index}>
                <Link href={`/${profile}`} color="blue.500">
                  {profile}
                </Link>
              </ListItem>
            ))}
          </UnorderedList>
        </Box>

        <Box>
          <Link href="https://github.com/pierce403/crypto.me-thirdweb" isExternal color="blue.500">
            View Project on GitHub
          </Link>
        </Box>
      </VStack>
    </Container>
  );
};

export default Home;
