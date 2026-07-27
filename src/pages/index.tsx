import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { keyframes } from '@emotion/react';
import {
  Badge,
  Box,
  Button,
  Container,
  Flex,
  Grid,
  Heading,
  HStack,
  Input,
  Link,
  Text,
  VStack,
} from '@chakra-ui/react';
import { ens_normalize } from '@adraffy/ens-normalize';
import { ColorModeToggle } from '../components/ColorMode';
import { HyperEthLogo } from '../components/HyperEthLogo';

const float = keyframes`
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(0, -10px, 0); }
`;

const orbit = keyframes`
  from { transform: rotateX(68deg) rotateZ(0deg); }
  to { transform: rotateX(68deg) rotateZ(360deg); }
`;

const shimmer = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const isValidENSName = (name: string): boolean => {
  if (!name || typeof name !== 'string') return false;
  if (/^0x[a-fA-F0-9]{40}$/.test(name)) return true;

  try {
    return ens_normalize(name).includes('.');
  } catch {
    return false;
  }
};

function SearchIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function FeatureIcon({ kind }: { kind: 'identity' | 'portfolio' | 'fresh' | 'resilient' }) {
  const paths = {
    identity: (
      <>
        <circle cx="12" cy="8" r="3" />
        <circle cx="6" cy="17" r="2" />
        <circle cx="18" cy="17" r="2" />
        <path d="M10.2 10.4 7.4 15M13.8 10.4l2.8 4.6M8 17h8" />
      </>
    ),
    portfolio: (
      <>
        <path d="M5 19V9M12 19V5M19 19v-7" />
        <path d="M3 19h18" />
      </>
    ),
    fresh: (
      <>
        <path d="M19 8a8 8 0 1 0 1 7" />
        <path d="M19 3v5h-5M12 8v5l3 2" />
      </>
    ),
    resilient: (
      <>
        <path d="M12 3 5 6v5c0 4.6 2.9 7.8 7 10 4.1-2.2 7-5.4 7-10V6l-7-3Z" />
        <path d="m8.8 12 2.1 2.1 4.5-4.5" />
      </>
    ),
  };

  return (
    <Flex
      width="42px"
      height="42px"
      align="center"
      justify="center"
      borderRadius="14px"
      bg="purple.100"
      color="purple.700"
      _dark={{ bg: 'rgba(139, 92, 246, 0.15)', color: 'purple.200' }}
    >
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {paths[kind]}
      </svg>
    </Flex>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <HStack gap={2}>
      <Box width="7px" height="7px" borderRadius="full" bg="#8b5cf6" boxShadow="0 0 18px #8b5cf6" />
      <Text
        fontSize="xs"
        fontWeight="bold"
        letterSpacing="0.18em"
        textTransform="uppercase"
        color="purple.700"
        _dark={{ color: 'purple.200' }}
      >
        {children}
      </Text>
    </HStack>
  );
}

function SignalCard({
  kind,
  kicker,
  title,
  description,
  children,
  gridColumn,
}: {
  kind: 'identity' | 'portfolio' | 'fresh' | 'resilient';
  kicker: string;
  title: string;
  description: string;
  children?: React.ReactNode;
  gridColumn: { base: string; lg: string };
}) {
  return (
    <Box
      gridColumn={gridColumn}
      position="relative"
      overflow="hidden"
      minH={{ base: '280px', md: '310px' }}
      p={{ base: 6, md: 8 }}
      borderRadius="28px"
      border="1px solid"
      borderColor="rgba(91, 65, 135, 0.16)"
      bg="rgba(255, 255, 255, 0.74)"
      boxShadow="0 24px 80px rgba(46, 28, 80, 0.08)"
      backdropFilter="blur(18px)"
      _dark={{
        bg: 'rgba(18, 15, 36, 0.78)',
        borderColor: 'rgba(196, 181, 253, 0.13)',
        boxShadow: '0 24px 80px rgba(0, 0, 0, 0.26)',
      }}
      _before={{
        content: '""',
        position: 'absolute',
        width: '220px',
        height: '220px',
        right: '-100px',
        top: '-110px',
        borderRadius: 'full',
        bg: 'rgba(139, 92, 246, 0.12)',
        filter: 'blur(1px)',
      }}
      transition="transform 220ms ease, border-color 220ms ease"
      _hover={{ transform: 'translateY(-4px)', borderColor: 'rgba(124, 58, 237, 0.34)' }}
    >
      <VStack align="stretch" gap={4} position="relative" zIndex={1} height="100%">
        <HStack justify="space-between">
          <FeatureIcon kind={kind} />
          <Text fontSize="xs" fontWeight="bold" letterSpacing="0.14em" textTransform="uppercase" color="fg.muted">
            {kicker}
          </Text>
        </HStack>
        <Box>
          <Heading as="h3" fontSize={{ base: 'xl', md: '2xl' }} letterSpacing="-0.03em" color="fg">
            {title}
          </Heading>
          <Text mt={2} color="fg.muted" lineHeight="1.75" maxW="lg">
            {description}
          </Text>
        </Box>
        {children}
      </VStack>
    </Box>
  );
}

const Home: React.FC = () => {
  const [ensName, setEnsName] = useState('');
  const [searchError, setSearchError] = useState('');
  const [recentProfiles, setRecentProfiles] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function fetchRecentProfiles() {
      try {
        const response = await fetch('/api/recent-profiles');
        if (!response.ok) return;

        const data = await response.json() as { profiles: string[] };
        if (!cancelled) {
          setRecentProfiles(data.profiles.filter(isValidENSName).slice(0, 6));
        }
      } catch (error) {
        console.error('Error fetching recent profiles:', error);
      }
    }

    fetchRecentProfiles();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const query = ensName.trim();

    if (!isValidENSName(query)) {
      setSearchError('Enter a valid ENS name or 0x Ethereum address.');
      return;
    }

    setSearchError('');
    void router.push(`/${encodeURIComponent(query)}`);
  };

  return (
    <Box data-testid="home-shell" minH="100vh" overflow="hidden" bg="#f7f5fb" color="fg" _dark={{ bg: '#070610' }}>
      <Head>
        <title>crypto.me — Your onchain identity, in one view</title>
        <meta
          name="description"
          content="Search any ENS name or Ethereum address to explore identity, social, messaging, token, and NFT signals in one profile."
        />
        <meta property="og:title" content="crypto.me — Every signal. One identity." />
        <meta property="og:description" content="A fast, resilient view of your onchain identity." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://crypto.me/" />
        <meta property="og:image" content="https://crypto.me/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="crypto.me — Every signal. One identity." />
        <meta name="twitter:description" content="A fast, resilient view of your onchain identity." />
        <meta name="twitter:image" content="https://crypto.me/og-image.png" />
        <meta key="theme-light" name="theme-color" content="#f7f5fb" media="(prefers-color-scheme: light)" />
        <meta key="theme-dark" name="theme-color" content="#070610" media="(prefers-color-scheme: dark)" />
        <link rel="canonical" href="https://crypto.me/" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>

      <Box
        as="header"
        position="absolute"
        insetInline={0}
        top={0}
        zIndex={10}
        borderBottom="1px solid"
        borderColor="rgba(91, 65, 135, 0.11)"
        bg="rgba(247, 245, 251, 0.68)"
        backdropFilter="blur(18px)"
        _dark={{ bg: 'rgba(7, 6, 16, 0.62)', borderColor: 'rgba(196, 181, 253, 0.11)' }}
      >
        <Container maxW="1200px" py={3} px={{ base: 4, md: 6 }}>
          <HStack justify="space-between">
            <Link href="/" aria-label="crypto.me home" _hover={{ textDecoration: 'none' }}>
              <HStack gap={2.5}>
                <HyperEthLogo size={38} label="" />
                <Box>
                  <Text fontSize="lg" fontWeight="black" letterSpacing="-0.04em" lineHeight="1">
                    crypto.me
                  </Text>
                  <Text display={{ base: 'none', sm: 'block' }} mt={1} fontSize="9px" fontWeight="bold" letterSpacing="0.16em" color="fg.muted">
                    ONCHAIN IDENTITY
                  </Text>
                </Box>
              </HStack>
            </Link>
            <HStack gap={3}>
              <Badge
                display={{ base: 'none', md: 'inline-flex' }}
                px={3}
                py={1.5}
                borderRadius="full"
                bg="rgba(124, 58, 237, 0.09)"
                color="purple.700"
                _dark={{ bg: 'rgba(167, 139, 250, 0.12)', color: 'purple.200' }}
              >
                Ethereum identities
              </Badge>
              <ColorModeToggle />
            </HStack>
          </HStack>
        </Container>
      </Box>

      <Box
        as="main"
        position="relative"
        pt={{ base: 28, md: 32 }}
        _before={{
          content: '""',
          position: 'absolute',
          inset: 0,
          height: '900px',
          pointerEvents: 'none',
          backgroundImage:
            'radial-gradient(circle at 72% 27%, rgba(139, 92, 246, 0.22), transparent 28%), radial-gradient(circle at 15% 34%, rgba(59, 130, 246, 0.14), transparent 26%)',
        }}
      >
        <Box
          position="absolute"
          insetInline={0}
          top={0}
          height="820px"
          opacity={{ base: 0.28, md: 0.42 }}
          pointerEvents="none"
          backgroundImage="linear-gradient(rgba(92, 73, 130, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(92, 73, 130, 0.08) 1px, transparent 1px)"
          backgroundSize="56px 56px"
          maskImage="linear-gradient(to bottom, black, transparent 78%)"
          _dark={{ opacity: 0.35 }}
        />

        <Container maxW="1200px" px={{ base: 4, md: 6 }} position="relative">
          <Grid
            minH={{ lg: '690px' }}
            templateColumns={{ base: '1fr', lg: 'minmax(0, 1.05fr) minmax(410px, 0.95fr)' }}
            alignItems="center"
            gap={{ base: 12, lg: 8 }}
          >
            <VStack align={{ base: 'center', lg: 'flex-start' }} textAlign={{ base: 'center', lg: 'left' }} gap={7} py={{ base: 6, lg: 12 }}>
              <Eyebrow>Every wallet has a story</Eyebrow>
              <Heading
                as="h1"
                maxW="760px"
                fontSize={{ base: '4xl', sm: '5xl', md: '6xl', lg: '72px' }}
                lineHeight={{ base: '1.04', lg: '0.98' }}
                letterSpacing="-0.065em"
                fontWeight="900"
              >
                Every signal.
                <Box
                  as="span"
                  display="block"
                  pb={2}
                  style={{
                    backgroundImage: 'linear-gradient(110deg, #2563eb, #7c3aed 48%, #db2777)',
                    backgroundSize: '200% 200%',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                  }}
                  animation={`${shimmer} 9s ease infinite`}
                  _motionReduce={{ animation: 'none' }}
                >
                  One identity.
                </Box>
              </Heading>
              <Text fontSize={{ base: 'lg', md: 'xl' }} color="fg.muted" maxW="620px" lineHeight="1.75">
                Enter an ENS name or Ethereum address. We assemble identity, social,
                messaging, tokens, and NFTs into one living profile.
              </Text>

              <Box width="100%" maxW="650px">
                <form onSubmit={handleSubmit} noValidate>
                  <Flex
                    align="center"
                    gap={2}
                    p={2}
                    borderRadius="22px"
                    border="1px solid"
                    borderColor={searchError ? 'red.400' : 'rgba(91, 65, 135, 0.22)'}
                    bg="rgba(255, 255, 255, 0.82)"
                    boxShadow="0 24px 70px rgba(70, 43, 112, 0.13)"
                    backdropFilter="blur(20px)"
                    _focusWithin={{
                      borderColor: 'purple.400',
                      boxShadow: '0 24px 80px rgba(109, 40, 217, 0.18), 0 0 0 3px rgba(139, 92, 246, 0.12)',
                    }}
                    _dark={{
                      bg: 'rgba(18, 15, 36, 0.86)',
                      borderColor: searchError ? 'red.400' : 'rgba(196, 181, 253, 0.2)',
                      boxShadow: '0 24px 70px rgba(0, 0, 0, 0.34)',
                    }}
                    transition="border-color 180ms ease, box-shadow 180ms ease"
                  >
                    <Flex pl={{ base: 2, md: 3 }} color="fg.muted" flexShrink={0}>
                      <SearchIcon />
                    </Flex>
                    <Input
                      data-testid="identity-search-input"
                      aria-label="ENS name or Ethereum address"
                      aria-describedby="identity-search-message"
                      aria-invalid={Boolean(searchError)}
                      value={ensName}
                      onChange={(event) => {
                        setEnsName(event.target.value);
                        if (searchError) setSearchError('');
                      }}
                      placeholder="deanpierce.eth or 0x…"
                      height={{ base: '52px', md: '58px' }}
                      px={2}
                      fontSize={{ base: 'md', md: 'lg' }}
                      bg="transparent"
                      border="0"
                      outline="none"
                      color="fg"
                      _placeholder={{ color: 'fg.subtle' }}
                      _focus={{ boxShadow: 'none', outline: 'none' }}
                    />
                    <Button
                      data-testid="identity-search-submit"
                      type="submit"
                      flexShrink={0}
                      height={{ base: '48px', md: '54px' }}
                      px={{ base: 4, md: 7 }}
                      borderRadius="16px"
                      bg="linear-gradient(135deg, #2563eb, #7c3aed 58%, #a855f7)"
                      color="white"
                      fontWeight="bold"
                      boxShadow="0 12px 28px rgba(109, 40, 217, 0.28)"
                      _hover={{ transform: 'translateY(-1px)', boxShadow: '0 16px 34px rgba(109, 40, 217, 0.36)' }}
                      _active={{ transform: 'translateY(0)' }}
                      transition="transform 160ms ease, box-shadow 160ms ease"
                    >
                      <Text as="span" display={{ base: 'none', sm: 'inline' }}>Explore profile</Text>
                      <Text as="span" display={{ base: 'inline', sm: 'none' }}>Explore</Text>
                      <Text as="span" aria-hidden="true" ml={2}>↗</Text>
                    </Button>
                  </Flex>
                </form>
                <Text
                  id="identity-search-message"
                  role={searchError ? 'alert' : undefined}
                  minH="22px"
                  mt={2}
                  px={3}
                  color={searchError ? 'red.500' : 'fg.subtle'}
                  fontSize="sm"
                  textAlign={{ base: 'center', lg: 'left' }}
                >
                  {searchError || 'Read-only exploration · no wallet connection required'}
                </Text>
              </Box>

              {recentProfiles.length > 0 && (
                <HStack gap={2} flexWrap="wrap" justify={{ base: 'center', lg: 'flex-start' }}>
                  <Text fontSize="xs" fontWeight="bold" letterSpacing="0.12em" textTransform="uppercase" color="fg.subtle">
                    Recently resolved
                  </Text>
                  {recentProfiles.map((profile) => (
                    <Link
                      key={profile}
                      href={`/${encodeURIComponent(profile)}`}
                      px={3}
                      py={1.5}
                      borderRadius="full"
                      border="1px solid"
                      borderColor="border"
                      bg="bg.panel"
                      color="fg.muted"
                      fontSize="xs"
                      fontWeight="semibold"
                      _hover={{ color: 'purple.600', borderColor: 'purple.300', textDecoration: 'none' }}
                      _dark={{ bg: 'rgba(18, 15, 36, 0.78)' }}
                    >
                      {profile}
                    </Link>
                  ))}
                </HStack>
              )}
            </VStack>

            <Flex
              data-testid="hyper-logo-stage"
              position="relative"
              minH={{ base: '390px', md: '520px', lg: '640px' }}
              align="center"
              justify="center"
              isolation="isolate"
            >
              <Box
                position="absolute"
                width={{ base: '310px', md: '430px' }}
                height={{ base: '310px', md: '430px' }}
                borderRadius="full"
                bg="radial-gradient(circle, rgba(124, 58, 237, 0.19), rgba(37, 99, 235, 0.07) 48%, transparent 70%)"
                filter="blur(4px)"
              />
              <Box
                position="absolute"
                width={{ base: '280px', md: '400px' }}
                height={{ base: '280px', md: '400px' }}
                border="1px solid"
                borderColor="rgba(124, 58, 237, 0.24)"
                borderRadius="full"
                animation={`${orbit} 18s linear infinite`}
                _motionReduce={{ animation: 'none' }}
                _before={{
                  content: '""',
                  position: 'absolute',
                  width: '9px',
                  height: '9px',
                  top: '46%',
                  left: '-5px',
                  borderRadius: 'full',
                  bg: '#7c3aed',
                  boxShadow: '0 0 22px #7c3aed',
                }}
              />
              <Box width={{ base: '230px', sm: '270px', md: '340px', lg: '390px' }} height={{ base: '230px', sm: '270px', md: '340px', lg: '390px' }}>
                <HyperEthLogo
                  size="100%"
                  animated
                  label="Crypto.me four-dimensional hypercube"
                />
              </Box>

              <Box
                position="absolute"
                left={{ base: '1%', sm: '6%', md: '0' }}
                top={{ base: '18%', md: '22%' }}
                px={3}
                py={2}
                borderRadius="14px"
                bg="rgba(255,255,255,0.78)"
                border="1px solid"
                borderColor="rgba(91,65,135,0.15)"
                boxShadow="lg"
                backdropFilter="blur(14px)"
                animation={`${float} 6s ease-in-out infinite`}
                _motionReduce={{ animation: 'none' }}
                _dark={{ bg: 'rgba(18,15,36,0.8)' }}
              >
                <Text fontSize="10px" letterSpacing="0.12em" fontWeight="bold" color="fg.muted">NAME</Text>
                <Text mt={0.5} fontSize="sm" fontWeight="bold">ENS</Text>
              </Box>
              <Box
                position="absolute"
                right={{ base: '1%', sm: '6%', md: '0' }}
                top={{ base: '30%', md: '32%' }}
                px={3}
                py={2}
                borderRadius="14px"
                bg="rgba(255,255,255,0.78)"
                border="1px solid"
                borderColor="rgba(91,65,135,0.15)"
                boxShadow="lg"
                backdropFilter="blur(14px)"
                animation={`${float} 7s 900ms ease-in-out infinite`}
                _motionReduce={{ animation: 'none' }}
                _dark={{ bg: 'rgba(18,15,36,0.8)' }}
              >
                <Text fontSize="10px" letterSpacing="0.12em" fontWeight="bold" color="fg.muted">MESSAGING</Text>
                <Text mt={0.5} fontSize="sm" fontWeight="bold">XMTP</Text>
              </Box>
              <Box
                position="absolute"
                right={{ base: '5%', sm: '12%', md: '5%' }}
                bottom={{ base: '17%', md: '20%' }}
                px={3}
                py={2}
                borderRadius="14px"
                bg="rgba(255,255,255,0.78)"
                border="1px solid"
                borderColor="rgba(91,65,135,0.15)"
                boxShadow="lg"
                backdropFilter="blur(14px)"
                animation={`${float} 6.5s 400ms ease-in-out infinite`}
                _motionReduce={{ animation: 'none' }}
                _dark={{ bg: 'rgba(18,15,36,0.8)' }}
              >
                <Text fontSize="10px" letterSpacing="0.12em" fontWeight="bold" color="fg.muted">PORTFOLIO</Text>
                <Text mt={0.5} fontSize="sm" fontWeight="bold">TOKENS + NFTS</Text>
              </Box>
            </Flex>
          </Grid>

          <Grid
            mt={{ base: 8, lg: 0 }}
            mb={{ base: 24, md: 32 }}
            templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }}
            border="1px solid"
            borderColor="rgba(91, 65, 135, 0.14)"
            borderRadius="22px"
            overflow="hidden"
            bg="rgba(255,255,255,0.55)"
            backdropFilter="blur(16px)"
            _dark={{ bg: 'rgba(18,15,36,0.58)', borderColor: 'rgba(196,181,253,0.12)' }}
          >
            {[
              ['Identity', 'ENS + wallets'],
              ['Social', 'Farcaster graph'],
              ['Messaging', 'XMTP inbox'],
              ['Assets', 'Tokens + NFTs'],
            ].map(([label, value], index) => (
              <Box
                key={label}
                px={{ base: 4, md: 6 }}
                py={5}
                borderRight={{ base: index % 2 === 0 ? '1px solid' : '0', md: index < 3 ? '1px solid' : '0' }}
                borderBottom={{ base: index < 2 ? '1px solid' : '0', md: '0' }}
                borderColor="rgba(91, 65, 135, 0.12)"
              >
                <Text fontSize="xs" fontWeight="bold" letterSpacing="0.12em" textTransform="uppercase" color="fg.subtle">
                  {label}
                </Text>
                <Text mt={1} fontWeight="bold">{value}</Text>
              </Box>
            ))}
          </Grid>
        </Container>

        <Box position="relative" py={{ base: 20, md: 28 }} bg="rgba(255,255,255,0.38)" _dark={{ bg: 'rgba(12,10,24,0.58)' }}>
          <Container maxW="1200px" px={{ base: 4, md: 6 }}>
            <VStack align={{ base: 'center', md: 'flex-start' }} textAlign={{ base: 'center', md: 'left' }} gap={4} mb={12}>
              <Eyebrow>One search · many sources</Eyebrow>
              <Heading as="h2" maxW="780px" fontSize={{ base: '3xl', md: '5xl' }} letterSpacing="-0.05em" lineHeight="1.06">
                A living profile, assembled at the edge.
              </Heading>
              <Text maxW="680px" color="fg.muted" fontSize={{ base: 'md', md: 'lg' }} lineHeight="1.75">
                Crypto.me keeps useful data fast and visible, then refreshes each signal independently in the background.
              </Text>
            </VStack>

            <Grid templateColumns={{ base: '1fr', lg: 'repeat(12, 1fr)' }} gap={5}>
              <SignalCard
                kind="identity"
                kicker="Identity graph"
                title="More than an address"
                description="Resolve names, wallets, social accounts, and messaging identities into one connected view."
                gridColumn={{ base: '1', lg: 'span 7' }}
              >
                <HStack mt="auto" gap={2} flexWrap="wrap">
                  {['ENS', 'Farcaster', 'XMTP', 'Icebreaker'].map((service) => (
                    <Badge key={service} px={3} py={1.5} borderRadius="full" colorPalette="purple" variant="subtle">
                      {service}
                    </Badge>
                  ))}
                </HStack>
              </SignalCard>

              <SignalCard
                kind="portfolio"
                kicker="Portfolio"
                title="What matters, ranked"
                description="See the most valuable priced token holdings and NFT collection-floor proxies without wading through dust."
                gridColumn={{ base: '1', lg: 'span 5' }}
              >
                <VStack align="stretch" gap={2} mt="auto">
                  {[
                    ['01', 'Tokens', 'Top 8'],
                    ['02', 'NFTs', 'Top 8'],
                  ].map(([number, label, value]) => (
                    <HStack key={label} justify="space-between" px={3} py={2.5} borderRadius="12px" bg="rgba(124,58,237,0.06)">
                      <HStack>
                        <Text fontFamily="mono" fontSize="xs" color="purple.500">{number}</Text>
                        <Text fontWeight="semibold">{label}</Text>
                      </HStack>
                      <Text fontSize="sm" color="fg.muted">{value}</Text>
                    </HStack>
                  ))}
                </VStack>
              </SignalCard>

              <SignalCard
                kind="fresh"
                kicker="Cache first"
                title="Fast now. Fresher next."
                description="Cached identity data renders immediately while durable background jobs refresh stale services."
                gridColumn={{ base: '1', lg: 'span 5' }}
              >
                <HStack mt="auto" gap={3}>
                  <Box flex={1} height="6px" borderRadius="full" bg="purple.100" overflow="hidden" _dark={{ bg: 'whiteAlpha.100' }}>
                    <Box width="82%" height="100%" bg="linear-gradient(90deg, #2563eb, #8b5cf6)" borderRadius="full" />
                  </Box>
                  <Text fontFamily="mono" fontSize="xs" color="fg.muted">EDGE READY</Text>
                </HStack>
              </SignalCard>

              <SignalCard
                kind="resilient"
                kicker="Fail soft"
                title="Still useful when providers are not"
                description="Each collector is bounded and independent, so one unavailable provider does not erase the rest of the profile."
                gridColumn={{ base: '1', lg: 'span 7' }}
              >
                <Grid mt="auto" templateColumns="repeat(3, 1fr)" gap={2}>
                  {['Cached', 'Partial', 'Refreshing'].map((status) => (
                    <Box key={status} p={3} borderRadius="12px" textAlign="center" bg="rgba(37,99,235,0.06)">
                      <Box mx="auto" mb={2} width="7px" height="7px" borderRadius="full" bg={status === 'Refreshing' ? 'purple.400' : 'green.400'} />
                      <Text fontSize="xs" fontWeight="semibold">{status}</Text>
                    </Box>
                  ))}
                </Grid>
              </SignalCard>
            </Grid>
          </Container>
        </Box>

        <Container maxW="1200px" px={{ base: 4, md: 6 }} py={{ base: 20, md: 28 }}>
          <Grid templateColumns={{ base: '1fr', md: '0.8fr 1.2fr' }} gap={{ base: 10, md: 16 }} alignItems="center">
            <Box>
              <Eyebrow>From name to signal</Eyebrow>
              <Heading as="h2" mt={4} fontSize={{ base: '3xl', md: '5xl' }} letterSpacing="-0.05em" lineHeight="1.08">
                One input. A whole onchain life.
              </Heading>
            </Box>
            <VStack align="stretch" gap={0}>
              {[
                ['01', 'Search', 'Enter an ENS name or Ethereum address.'],
                ['02', 'Resolve', 'We connect identity, social, messaging, and asset signals.'],
                ['03', 'Explore', 'Open a durable profile that gets better as data refreshes.'],
              ].map(([number, title, description]) => (
                <Grid
                  key={number}
                  templateColumns="48px minmax(0, 1fr)"
                  gap={4}
                  py={5}
                  borderBottom="1px solid"
                  borderColor="border"
                >
                  <Text fontFamily="mono" color="purple.500" fontSize="sm">{number}</Text>
                  <Box>
                    <Text fontWeight="bold" fontSize="lg">{title}</Text>
                    <Text mt={1} color="fg.muted">{description}</Text>
                  </Box>
                </Grid>
              ))}
            </VStack>
          </Grid>
        </Container>
      </Box>

      <Box as="footer" borderTop="1px solid" borderColor="border" py={8}>
        <Container maxW="1200px" px={{ base: 4, md: 6 }}>
          <Flex direction={{ base: 'column', sm: 'row' }} align="center" justify="space-between" gap={4}>
            <HStack gap={2}>
              <HyperEthLogo size={28} label="" />
              <Text fontWeight="bold">crypto.me</Text>
            </HStack>
            <Text color="fg.muted" fontSize="sm" textAlign="center">
              One profile across the open web.
            </Text>
            <Text color="fg.subtle" fontFamily="mono" fontSize="xs">
              POWERED BY ETHEREUM DATA
            </Text>
          </Flex>
        </Container>
      </Box>
    </Box>
  );
};

export default Home;
