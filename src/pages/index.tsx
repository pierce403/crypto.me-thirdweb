import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  Box,
  Container,
  Heading,
  Text,
  Input,
  Button,
  VStack,
  SimpleGrid,
  Flex,
  Badge,
  Link
} from '@chakra-ui/react';
import { ens_normalize } from '@adraffy/ens-normalize';
import { ColorModeToggle } from '../components/ColorMode';

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

const FeatureCard = ({ emoji, title, desc }: { emoji: string, title: string, desc: string }) => (
  <Box bg="bg.panel" p={8} borderRadius="xl" boxShadow="sm" border="1px" borderColor="border.muted" height="100%">
    <Text fontSize="4xl" mb={4}>{emoji}</Text>
    <Heading size="md" mb={2} color="fg">{title}</Heading>
    <Text color="fg.muted">{desc}</Text>
  </Box>
);

const Home: React.FC = () => {
  const [ensName, setEnsName] = useState<string>('');
  const [recentProfiles, setRecentProfiles] = useState<string[]>([]);
  const router = useRouter();

  const fetchRecentProfiles = async () => {
    try {
      const response = await fetch('/api/recent-profiles');
      if (response.ok) {
        const data = await response.json() as { profiles: string[] };
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
    fetchRecentProfiles();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ensName) {
      router.push(`/${ensName}`);
    }
  };

  return (
    <Box data-testid="home-shell" minH="100vh" bg="bg.subtle" color="fg" _dark={{ bg: 'bg' }}>
      <Head>
        <title>Crypto.me | Web3 Identity Aggregator</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Hero Section */}
      <Box position="relative" bg="bg.panel" borderBottom="1px" borderColor="border" pb={20} pt={16}>
        <Box position="absolute" top={4} right={{ base: 4, md: 8 }} zIndex={1}>
          <ColorModeToggle />
        </Box>
        <Container maxW="container.lg">
          <VStack gap={8} align="center" textAlign="center">
            <Heading
              as="h1"
              size="4xl"
              fontWeight="extrabold"
              letterSpacing="tight"
              style={{
                backgroundImage: 'linear-gradient(to right, #3182ce, #805ad5)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              crypto.me
            </Heading>
            <Text fontSize="xl" color="fg.muted" maxW="2xl" lineHeight="tall">
              The fastest way to view your aggregated Web3 identity. <br />
              <strong>ENS, Farcaster, DeFi, and NFTs</strong> — all in one place.
            </Text>

            <Box width="100%" maxW="md" mt={6}>
              <form onSubmit={handleSubmit}>
                <VStack gap={4}>
                  <Input
                    size="lg"
                    placeholder="Search ENS (e.g. vitalik.eth) or 0x..."
                    value={ensName}
                    onChange={(e) => setEnsName(e.target.value)}
                    bg="bg.panel"
                    color="fg"
                    borderColor="border"
                    boxShadow="md"
                    _placeholder={{ color: 'fg.muted' }}
                    _focus={{ boxShadow: "lg", borderColor: "blue.focusRing" }}
                    height="60px"
                    fontSize="lg"
                    borderRadius="full"
                    px={6}
                  />
                  <Button
                    type="submit"
                    colorScheme="blue"
                    size="lg"
                    width="full"
                    height="50px"
                    fontSize="lg"
                    borderRadius="full"
                    disabled={!ensName}
                    _hover={{ transform: 'translateY(-1px)', boxShadow: 'md' }}
                  >
                    View Profile
                  </Button>
                </VStack>
              </form>
            </Box>

            {/* Recent Profiles */}
            {recentProfiles.length > 0 && (
              <Box mt={6}>
                <Text fontSize="sm" color="fg.muted" mb={3} textTransform="uppercase" letterSpacing="wider" fontWeight="bold">Recently Viewed</Text>
                <Flex gap={2} wrap="wrap" justify="center">
                  {recentProfiles.map((profile) => (
                    <Link
                      key={profile}
                      href={`/${profile}`}
                      _hover={{ textDecoration: "none" }}
                    >
                      <Badge
                        px={4}
                        py={2}
                        borderRadius="full"
                        colorScheme="gray"
                        cursor="pointer"
                        _hover={{ bg: "bg.emphasized" }}
                        fontSize="sm"
                        textTransform="none"
                      >
                        {profile}
                      </Badge>
                    </Link>
                  ))}
                </Flex>
              </Box>
            )}
          </VStack>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxW="container.lg" py={20}>
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={8}>
          <FeatureCard
            emoji="🆔"
            title="Identity First"
            desc="Resolves ENS names, avatars, and cross-chain identities including Gitcoin Passport and Icebreaker."
          />
          <FeatureCard
            emoji="🤝"
            title="Social Graph"
            desc="View Farcaster profiles, follower counts, and social scores in a unified view."
          />
          <FeatureCard
            emoji="💰"
            title="Assets & DeFi"
            desc="Aggregated view of NFT collections (Alchemy/OpenSea) and DeFi positions (DeBank)."
          />
        </SimpleGrid>
      </Container>

      {/* Footer */}
      <Box py={10} textAlign="center" color="fg.muted" fontSize="sm" borderTop="1px" borderColor="border">
        <Text>Built with Next.js, Prisma & Chakra UI</Text>
      </Box>
    </Box>
  );
};

export default Home;
