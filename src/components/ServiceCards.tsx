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

interface OpenSeaData {
  profileUrl: string;
  topNFTs: Array<{
    name: string;
    collection: string;
    image: string;
    value: number;
    currency: string;
    permalink: string;
  }>;
  totalValue: number;
}

interface DecentralandData {
  profileUrl: string;
  avatar: {
    name: string;
    image: string;
  } | null;
  landParcels: number;
  wearables: number;
  lastActive: string | null;
}

interface GitcoinPassportData {
  score: number;
  stamps: Array<{
    provider: string;
    verified: boolean;
    category: string;
  }>;
  lastUpdated: string;
  trustLevel: string;
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

export const OpenSeaCard: React.FC<ServiceCardProps> = ({ address }) => {
  const [data, setData] = useState<OpenSeaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOpenSeaData = async () => {
      try {
        const response = await fetch(`/api/services/opensea?address=${address}`);
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch OpenSea data');
        }
        
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchOpenSeaData();
  }, [address]);

  if (loading) {
    return (
      <Card.Root>
        <Card.Header>
          <Heading size="md">OpenSea NFTs</Heading>
        </Card.Header>
        <Card.Body>
          <HStack justify="center">
            <Spinner />
            <Text>Loading NFT collection...</Text>
          </HStack>
        </Card.Body>
      </Card.Root>
    );
  }

  if (error) {
    return (
      <Card.Root>
        <Card.Header>
          <Heading size="md">OpenSea NFTs</Heading>
        </Card.Header>
        <Card.Body>
          <Box p={4} bg="red.50" borderRadius="md" borderWidth="1px" borderColor="red.200">
            {error.includes('API key') ? (
              <VStack align="start" gap={2}>
                <Text fontWeight="bold" color="red.600">OpenSea API Key Required</Text>
                <Text fontSize="sm" color="red.500">Please configure OPENSEA_API_KEY in your environment variables to display NFT data.</Text>
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
        <HStack justify="space-between">
          <Heading size="md">OpenSea NFTs</Heading>
          <Link href={data?.profileUrl} target="_blank" color="blue.500" fontSize="sm">
            View Profile →
          </Link>
        </HStack>
      </Card.Header>
      <Card.Body>
        {data?.topNFTs && data.topNFTs.length > 0 ? (
          <VStack align="start" gap={4}>
            <Text fontWeight="semibold">Top 5 Most Valuable NFTs:</Text>
            {data.topNFTs.map((nft, index) => (
              <HStack key={index} gap={3} width="full">
                <Image
                  src={nft.image}
                  alt={nft.name}
                  boxSize="40px"
                  borderRadius="md"
                  objectFit="cover"
                />
                <VStack align="start" gap={0} flex={1}>
                  <Link href={nft.permalink} target="_blank" color="blue.500" fontSize="sm" fontWeight="bold">
                    {nft.name}
                  </Link>
                  <Text fontSize="xs" color="gray.500">{nft.collection}</Text>
                  <Text fontSize="xs" fontWeight="bold" color="green.600">
                    {nft.value} {nft.currency}
                  </Text>
                </VStack>
              </HStack>
            ))}
            {data.totalValue > 0 && (
              <Box width="full" pt={2} borderTopWidth="1px" borderColor="gray.200">
                <Text fontSize="sm" fontWeight="bold">
                  Total Portfolio Value: <Text as="span" color="green.600">{data.totalValue.toFixed(2)} ETH</Text>
                </Text>
              </Box>
            )}
          </VStack>
        ) : (
          <Text color="gray.500">No NFTs found or portfolio is private</Text>
        )}
      </Card.Body>
    </Card.Root>
  );
};

export const DecentralandCard: React.FC<ServiceCardProps> = ({ address }) => {
  const [data, setData] = useState<DecentralandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDecentralandData = async () => {
      try {
        const response = await fetch(`/api/services/decentraland?address=${address}`);
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch Decentraland data');
        }
        
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchDecentralandData();
  }, [address]);

  if (loading) {
    return (
      <Card.Root>
        <Card.Header>
          <Heading size="md">Decentraland</Heading>
        </Card.Header>
        <Card.Body>
          <HStack justify="center">
            <Spinner />
            <Text>Loading Decentraland profile...</Text>
          </HStack>
        </Card.Body>
      </Card.Root>
    );
  }

  if (error) {
    return (
      <Card.Root>
        <Card.Header>
          <Heading size="md">Decentraland</Heading>
        </Card.Header>
        <Card.Body>
          <Box p={4} bg="red.50" borderRadius="md" borderWidth="1px" borderColor="red.200">
            <Text color="red.600">{error}</Text>
          </Box>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <Card.Root>
      <Card.Header>
        <HStack justify="space-between">
          <Heading size="md">Decentraland</Heading>
          <Link href={data?.profileUrl} target="_blank" color="blue.500" fontSize="sm">
            View Profile →
          </Link>
        </HStack>
      </Card.Header>
      <Card.Body>
        {data && (data.avatar || data.landParcels > 0 || data.wearables > 0 || data.lastActive) ? (
          <VStack align="start" gap={4}>
            {data.avatar && (
              <HStack gap={3}>
                <Image
                  src={data.avatar.image}
                  alt={data.avatar.name}
                  boxSize="50px"
                  borderRadius="full"
                />
                <VStack align="start" gap={0}>
                  <Text fontWeight="bold">{data.avatar.name}</Text>
                  <Text fontSize="sm" color="gray.500">Avatar</Text>
                </VStack>
              </HStack>
            )}
            
            <HStack wrap="wrap" gap={4}>
              <VStack align="start" gap={1}>
                <Text fontSize="sm" color="gray.500">Land Parcels</Text>
                <Text fontSize="lg" fontWeight="bold" color="purple.600">{data.landParcels}</Text>
              </VStack>
              
              <VStack align="start" gap={1}>
                <Text fontSize="sm" color="gray.500">Wearables</Text>
                <Text fontSize="lg" fontWeight="bold" color="purple.600">{data.wearables}</Text>
              </VStack>
            </HStack>
            
            {data.lastActive && (
              <Box>
                <Text fontSize="sm" color="gray.500">Last Active:</Text>
                <Text fontSize="sm">{new Date(data.lastActive).toLocaleDateString()}</Text>
              </Box>
            )}
          </VStack>
        ) : (
          <VStack align="start" gap={3}>
            <Text color="gray.500">No Decentraland profile or assets found for this address</Text>
            <Text fontSize="sm" color="gray.400">
              This address may not have interacted with Decentraland or may not have a public profile.
            </Text>
            <HStack gap={4}>
              <VStack align="start" gap={1}>
                <Text fontSize="sm" color="gray.500">Land Parcels</Text>
                <Text fontSize="lg" fontWeight="bold" color="purple.600">0</Text>
              </VStack>
              
              <VStack align="start" gap={1}>
                <Text fontSize="sm" color="gray.500">Wearables</Text>
                <Text fontSize="lg" fontWeight="bold" color="purple.600">0</Text>
              </VStack>
            </HStack>
          </VStack>
        )}
      </Card.Body>
    </Card.Root>
  );
};

export const GitcoinPassportCard: React.FC<ServiceCardProps> = ({ address }) => {
  const [data, setData] = useState<GitcoinPassportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGitcoinPassportData = async () => {
      try {
        const response = await fetch(`/api/services/gitcoin-passport?address=${address}`);
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch Gitcoin Passport data');
        }
        
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchGitcoinPassportData();
  }, [address]);

  if (loading) {
    return (
      <Card.Root>
        <Card.Header>
          <Heading size="md">Gitcoin Passport</Heading>
        </Card.Header>
        <Card.Body>
          <HStack justify="center">
            <Spinner />
            <Text>Loading passport data...</Text>
          </HStack>
        </Card.Body>
      </Card.Root>
    );
  }

  if (error) {
    return (
      <Card.Root>
        <Card.Header>
          <Heading size="md">Gitcoin Passport</Heading>
        </Card.Header>
        <Card.Body>
          <Box p={4} bg="red.50" borderRadius="md" borderWidth="1px" borderColor="red.200">
            {error.includes('API key') ? (
              <VStack align="start" gap={2}>
                <Text fontWeight="bold" color="red.600">Gitcoin Passport API Key Required</Text>
                <Text fontSize="sm" color="red.500">Please configure GITCOIN_PASSPORT_API_KEY in your environment variables to display passport data.</Text>
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
        <Heading size="md">Gitcoin Passport</Heading>
      </Card.Header>
      <Card.Body>
        {data ? (
          <VStack align="start" gap={4}>
            <HStack gap={4} width="full">
              <VStack align="start" gap={1}>
                <Text fontSize="sm" color="gray.500">Passport Score</Text>
                <HStack gap={2}>
                  <Text fontSize="2xl" fontWeight="bold" color={data.score > 15 ? "green.600" : data.score > 10 ? "yellow.600" : "red.600"}>
                    {data.score.toFixed(1)}
                  </Text>
                  <Badge colorPalette={data.trustLevel === 'High' ? "green" : data.trustLevel === 'Medium' ? "yellow" : "red"} variant="subtle">
                    {data.trustLevel}
                  </Badge>
                </HStack>
              </VStack>
              
              <VStack align="start" gap={1}>
                <Text fontSize="sm" color="gray.500">Verified Stamps</Text>
                <Text fontSize="lg" fontWeight="bold">{data.stamps.filter(s => s.verified).length}/{data.stamps.length}</Text>
              </VStack>
            </HStack>
            
            {data.stamps.length > 0 && (
              <Box width="full">
                <Text fontWeight="semibold" mb={2}>Recent Stamps:</Text>
                <VStack align="start" gap={2}>
                  {data.stamps.slice(0, 4).map((stamp, index) => (
                    <HStack key={index} justify="space-between" width="full">
                      <HStack gap={2}>
                        <Text fontSize="sm" textTransform="capitalize">{stamp.provider}</Text>
                        <Badge colorPalette="gray" variant="subtle" size="sm">
                          {stamp.category}
                        </Badge>
                      </HStack>
                      <Badge colorPalette={stamp.verified ? "green" : "gray"} variant="subtle" size="sm">
                        {stamp.verified ? "✓" : "○"}
                      </Badge>
                    </HStack>
                  ))}
                  {data.stamps.length > 4 && (
                    <Text fontSize="xs" color="gray.500">
                      +{data.stamps.length - 4} more stamps
                    </Text>
                  )}
                </VStack>
              </Box>
            )}
            
            <Text fontSize="xs" color="gray.400">
              Last updated: {new Date(data.lastUpdated).toLocaleDateString()}
            </Text>
          </VStack>
        ) : (
          <Text color="gray.500">No Gitcoin Passport found for this address</Text>
        )}
      </Card.Body>
    </Card.Root>
  );
}; 