import React, { useState, useEffect } from 'react';
import { Box, Card, Heading, Text, VStack, HStack, Badge, Link, Image, Spinner } from '@chakra-ui/react';

interface ServiceCardProps {
  address: string;
  ensName: string;
}

interface ENSData {
  primaryName: string;
  avatar: string | null;
  otherNames: string[];
  profileUrl: string;
}

interface IcebreakerData {
  socialIdentities: Array<{
    platform: string;
    username: string;
    verified: boolean;
  }>;
}

interface FarcasterData {
  username: string;
  displayName: string;
  createdAt: string;
  connectedAddresses: string[];
  followerCount: number;
  neynarScore: number;
}

export const ENSCard: React.FC<ServiceCardProps> = ({ address, ensName }) => {
  const [data, setData] = useState<ENSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchENSData = async () => {
      try {
        const response = await fetch(`/api/services/ens?address=${address}&ensName=${ensName}`);
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch ENS data');
        }
        
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchENSData();
  }, [address, ensName]);

  if (loading) {
    return (
      <Card.Root>
        <Card.Header>
          <Heading size="md">ENS Profile</Heading>
        </Card.Header>
        <Card.Body>
          <HStack justify="center">
            <Spinner />
            <Text>Loading ENS data...</Text>
          </HStack>
        </Card.Body>
      </Card.Root>
    );
  }

  if (error) {
    return (
      <Card.Root>
        <Card.Header>
          <Heading size="md">ENS Profile</Heading>
        </Card.Header>
        <Card.Body>
          <Box p={4} bg="red.50" borderRadius="md" borderWidth="1px" borderColor="red.200">
            {error.includes('API key') ? (
              <VStack align="start" gap={2}>
                <Text fontWeight="bold" color="red.600">ENS API Key Required</Text>
                <Text fontSize="sm" color="red.500">Please configure ENS_API_KEY in your environment variables to display ENS profile data.</Text>
              </VStack>
            ) : (
              <Text color="red.600">{error}</Text>
            )}
          </Box>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <Card.Root>
      <Card.Header>
        <Heading size="md">ENS Profile</Heading>
      </Card.Header>
      <Card.Body>
        <VStack align="start" gap={4}>
          <HStack gap={4}>
            {data?.avatar && (
              <Image
                src={data.avatar}
                alt="ENS Avatar"
                boxSize="60px"
                borderRadius="full"
              />
            )}
            <VStack align="start" gap={1}>
              <Text fontWeight="bold" fontSize="lg">{data?.primaryName || ensName}</Text>
              <Link href={data?.profileUrl} target="_blank" color="blue.500" fontSize="sm">
                View on ENS →
              </Link>
            </VStack>
          </HStack>
          
          {data?.otherNames && data.otherNames.length > 0 && (
            <Box>
              <Text fontWeight="semibold" mb={2}>Other ENS Names:</Text>
              <HStack wrap="wrap" gap={2}>
                {data.otherNames.slice(0, 5).map((name, index) => (
                  <Badge key={index} colorPalette="blue" variant="subtle">
                    {name}
                  </Badge>
                ))}
                {data.otherNames.length > 5 && (
                  <Badge colorPalette="gray" variant="subtle">
                    +{data.otherNames.length - 5} more
                  </Badge>
                )}
              </HStack>
            </Box>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};

export const IcebreakerCard: React.FC<ServiceCardProps> = ({ address }) => {
  const [data, setData] = useState<IcebreakerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchIcebreakerData = async () => {
      try {
        const response = await fetch(`/api/services/icebreaker?address=${address}`);
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch Icebreaker data');
        }
        
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchIcebreakerData();
  }, [address]);

  if (loading) {
    return (
      <Card.Root>
        <Card.Header>
          <Heading size="md">Icebreaker Social</Heading>
        </Card.Header>
        <Card.Body>
          <HStack justify="center">
            <Spinner />
            <Text>Loading social identities...</Text>
          </HStack>
        </Card.Body>
      </Card.Root>
    );
  }

  if (error) {
    return (
      <Card.Root>
        <Card.Header>
          <Heading size="md">Icebreaker Social</Heading>
        </Card.Header>
        <Card.Body>
          <Box p={4} bg="red.50" borderRadius="md" borderWidth="1px" borderColor="red.200">
            {error.includes('API key') ? (
              <VStack align="start" gap={2}>
                <Text fontWeight="bold" color="red.600">Icebreaker API Key Required</Text>
                <Text fontSize="sm" color="red.500">Please configure ICEBREAKER_API_KEY in your environment variables to display social identities.</Text>
              </VStack>
            ) : (
              <Text color="red.600">{error}</Text>
            )}
          </Box>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <Card.Root>
      <Card.Header>
        <Heading size="md">Icebreaker Social</Heading>
      </Card.Header>
      <Card.Body>
        {data?.socialIdentities && data.socialIdentities.length > 0 ? (
          <VStack align="start" gap={3}>
            <Text fontWeight="semibold">Connected Social Identities:</Text>
            {data.socialIdentities.map((identity, index) => (
              <HStack key={index} justify="space-between" width="full">
                <HStack gap={2}>
                  <Text fontWeight="medium" textTransform="capitalize">{identity.platform}:</Text>
                  <Text>{identity.username}</Text>
                </HStack>
                {identity.verified && (
                  <Badge colorPalette="green" variant="subtle" size="sm">
                    Verified
                  </Badge>
                )}
              </HStack>
            ))}
          </VStack>
        ) : (
          <Text color="gray.500">No social identities found on Icebreaker</Text>
        )}
      </Card.Body>
    </Card.Root>
  );
};

export const FarcasterCard: React.FC<ServiceCardProps> = ({ address }) => {
  const [data, setData] = useState<FarcasterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFarcasterData = async () => {
      try {
        const response = await fetch(`/api/services/farcaster?address=${address}`);
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch Farcaster data');
        }
        
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchFarcasterData();
  }, [address]);

  if (loading) {
    return (
      <Card.Root>
        <Card.Header>
          <Heading size="md">Farcaster Profile</Heading>
        </Card.Header>
        <Card.Body>
          <HStack justify="center">
            <Spinner />
            <Text>Loading Farcaster data...</Text>
          </HStack>
        </Card.Body>
      </Card.Root>
    );
  }

  if (error) {
    return (
      <Card.Root>
        <Card.Header>
          <Heading size="md">Farcaster Profile</Heading>
        </Card.Header>
        <Card.Body>
          <Box p={4} bg="red.50" borderRadius="md" borderWidth="1px" borderColor="red.200">
            {error.includes('API key') ? (
              <VStack align="start" gap={2}>
                <Text fontWeight="bold" color="red.600">Neynar API Key Required</Text>
                <Text fontSize="sm" color="red.500">Please configure NEYNAR_API_KEY in your environment variables to display Farcaster profile data.</Text>
              </VStack>
            ) : (
              <Text color="red.600">{error}</Text>
            )}
          </Box>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <Card.Root>
      <Card.Header>
        <Heading size="md">Farcaster Profile</Heading>
      </Card.Header>
      <Card.Body>
        {data ? (
          <VStack align="start" gap={3}>
            <VStack align="start" gap={1}>
              <Text fontWeight="bold" fontSize="lg">@{data.username}</Text>
              <Text color="gray.600">{data.displayName}</Text>
            </VStack>
            
            <HStack wrap="wrap" gap={4}>
              <VStack align="start" gap={1}>
                <Text fontSize="sm" color="gray.500">Joined</Text>
                <Text fontSize="sm">{new Date(data.createdAt).toLocaleDateString()}</Text>
              </VStack>
              
              <VStack align="start" gap={1}>
                <Text fontSize="sm" color="gray.500">Followers</Text>
                <Text fontSize="sm" fontWeight="bold">{data.followerCount.toLocaleString()}</Text>
              </VStack>
              
              <VStack align="start" gap={1}>
                <Text fontSize="sm" color="gray.500">Neynar Score</Text>
                <Badge colorPalette={data.neynarScore > 0.5 ? "green" : "yellow"} variant="subtle">
                  {data.neynarScore.toFixed(2)}
                </Badge>
              </VStack>
            </HStack>
            
            {data.connectedAddresses && data.connectedAddresses.length > 0 && (
              <Box>
                <Text fontSize="sm" color="gray.500" mb={2}>Connected Addresses:</Text>
                <VStack align="start" gap={1}>
                  {data.connectedAddresses.slice(0, 3).map((addr, index) => (
                    <Text key={index} fontSize="xs" fontFamily="mono" color="gray.600">
                      {addr.slice(0, 6)}...{addr.slice(-4)}
                    </Text>
                  ))}
                  {data.connectedAddresses.length > 3 && (
                    <Text fontSize="xs" color="gray.500">
                      +{data.connectedAddresses.length - 3} more
                    </Text>
                  )}
                </VStack>
              </Box>
            )}
          </VStack>
        ) : (
          <Text color="gray.500">No Farcaster profile found for this address</Text>
        )}
      </Card.Body>
    </Card.Root>
  );
}; 