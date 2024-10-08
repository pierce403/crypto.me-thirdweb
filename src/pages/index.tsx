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
    <Container maxW="container.md" py={16} centerContent>
      <Head>
        <title>Crypto.me Profile</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <VStack spacing={8} align="center">
        <Heading as="h1" size="2xl" textAlign="center">Crypto.me Profile</Heading>

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
              <Button type="submit" colorScheme="blue" size="lg">
                View Profile
              </Button>
            </HStack>
          </form>
        </Box>

        <Box width="100%" mt={8}>
          <Heading as="h2" size="lg" textAlign="center">Recently Updated Profiles</Heading>
          <UnorderedList styleType="none" spacing={2} mt={4}>
            {recentProfiles.map((profile, index) => (
              <ListItem key={index} textAlign="center">
                <Link href={`/${profile}`} color="blue.500" fontSize="lg">
                  {profile}
                </Link>
              </ListItem>
            ))}
          </UnorderedList>
        </Box>
      </VStack>
    </Container>
  );
};

export default Home;