import React from 'react';
import { Box, Text, VStack, HStack, Badge, Link, Skeleton, Image as ChakraImage } from '@chakra-ui/react';
import Image from 'next/image';

interface ServiceCardProps {
  data: Record<string, unknown> | null;
  loading?: boolean;
  serviceName: string;
  icon?: string;
  description?: string;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ 
  data, 
  loading = false, 
  serviceName, 
  icon, 
  description 
}) => {
  const isEmpty = !data || (typeof data === 'object' && Object.keys(data).length === 0);

  const renderContent = () => {
    if (!data) return null;

    switch (serviceName) {
      case 'ENS':
        return <ENSContent data={data} />;
      case 'Farcaster':
        return <FarcasterContent data={data} />;
      case 'Alchemy':
        return <AlchemyContent data={data} />;
      case 'OpenSea':
        return <OpenSeaContent data={data} />;
      case 'Icebreaker':
        return <IcebreakerContent data={data} />;
      case 'Human Passport':
        return <HumanPassportContent data={data} />;
      case 'Decentraland':
        return <DecentralandContent data={data} />;
      case 'DeBank':
        return <DeBankContent data={data} />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Box 
        p={4} 
        borderWidth={1} 
        borderRadius="lg" 
        borderColor="gray.200" 
        bg="white" 
        shadow="sm"
        minH="200px"
      >
        <VStack gap={3} align="stretch">
          <HStack gap={2} align="center">
            <Text fontSize="lg">{icon || '🔧'}</Text>
            <Text fontWeight="bold" color="gray.700">{serviceName}</Text>
          </HStack>
          
          <Skeleton height="20px" />
          <Skeleton height="20px" />
          <Skeleton height="60px" />
        </VStack>
      </Box>
    );
  }

  if (isEmpty) {
    return (
      <Box 
        p={4} 
        borderWidth={1} 
        borderRadius="lg" 
        borderColor="gray.200" 
        bg="gray.50" 
        shadow="sm"
        minH="200px"
      >
        <VStack gap={3} align="stretch">
          <HStack gap={2} align="center">
            <Text fontSize="lg">{icon || '🔧'}</Text>
            <Text fontWeight="bold" color="gray.400">{serviceName}</Text>
          </HStack>
          
          <Text fontSize="sm" color="gray.500" textAlign="center">
            {description || 'No data available'}
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box 
      p={4} 
      borderWidth={1} 
      borderRadius="lg" 
      borderColor="gray.200" 
      bg="white" 
      shadow="sm"
      minH="200px"
      transition="all 0.2s"
      _hover={{ shadow: "md", borderColor: "blue.300" }}
    >
      <VStack gap={3} align="stretch">
        <HStack gap={2} align="center">
          <Text fontSize="lg">{icon || '🔧'}</Text>
          <Text fontWeight="bold" color="gray.700">{serviceName}</Text>
        </HStack>
        
        {renderContent()}
      </VStack>
    </Box>
  );
};

const ENSContent: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const primaryName = data.primaryName as string | null;
  const avatar = data.avatar as string | null;
  const otherNames = data.otherNames as string[] | undefined;
  const profileUrl = data.profileUrl as string | undefined;

  return (
    <VStack gap={3} align="stretch">
      {primaryName && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">Primary Name:</Text>
          <Text fontSize="md" color="gray.800">{primaryName}</Text>
        </Box>
      )}
      
      {avatar && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">Avatar:</Text>
          <ChakraImage src={avatar} alt="ENS Avatar" maxH="80px" borderRadius="md" />
        </Box>
      )}
      
      {otherNames && otherNames.length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">Other Names:</Text>
          {otherNames.slice(0, 3).map((name, index) => (
            <Text key={index} fontSize="sm" color="gray.700">{name}</Text>
          ))}
          {otherNames.length > 3 && (
            <Text fontSize="xs" color="gray.500">+{otherNames.length - 3} more</Text>
          )}
        </Box>
      )}
      
      {profileUrl && (
        <Link href={profileUrl} target="_blank" rel="noopener noreferrer" color="blue.500" fontSize="sm">
          View on ENS ↗
        </Link>
      )}
    </VStack>
  );
};

const FarcasterContent: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const username = data.username as string | undefined;
  const displayName = data.displayName as string | undefined;
  const followerCount = data.followerCount as number | undefined;
  const bio = data.bio as string | undefined;
  const profileUrl = data.profileUrl as string | undefined;
  const neynarScore = data.neynarScore as number | undefined;

  return (
    <VStack gap={3} align="stretch">
      {username && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">Username:</Text>
          <Text fontSize="md" color="gray.800">@{username}</Text>
        </Box>
      )}
      
      {displayName && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">Display Name:</Text>
          <Text fontSize="md" color="gray.800">{displayName}</Text>
        </Box>
      )}
      
      {(followerCount !== undefined) && (
        <HStack gap={4}>
          {followerCount !== undefined && (
            <Box>
              <Text fontSize="xs" color="gray.600">Followers</Text>
              <Text fontSize="lg" fontWeight="bold" color="purple.600">{followerCount.toLocaleString()}</Text>
            </Box>
          )}
        </HStack>
      )}
      
      {bio && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">Bio:</Text>
          <Text fontSize="sm" color="gray.700" truncate>{bio}</Text>
        </Box>
      )}
      
      {neynarScore !== undefined && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">Neynar Score:</Text>
          <HStack align="baseline">
            <Text fontSize="lg" fontWeight="bold" color={
              neynarScore >= 0.7 ? "green.500" :
              neynarScore >= 0.4 ? "yellow.500" :
              "red.500"
            }>
              {(neynarScore * 100).toFixed(0)}%
            </Text>
            <Badge 
              colorScheme={
                neynarScore >= 0.7 ? "green" :
                neynarScore >= 0.4 ? "yellow" :
                "red"
              }
              variant="subtle"
            >
              {
                neynarScore >= 0.7 ? "High" :
                neynarScore >= 0.4 ? "Medium" :
                "Low"
              }
            </Badge>
            <Text fontSize="xs" color="gray.500">({neynarScore.toFixed(3)})</Text>
          </HStack>
        </Box>
      )}
      
      {profileUrl && (
        <Link href={profileUrl} target="_blank" rel="noopener noreferrer" color="purple.500" fontSize="sm">
          View on Farcaster ↗
        </Link>
      )}
    </VStack>
  );
};

const AlchemyContent: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const totalCount = data.totalCount as number | undefined;
  const nfts = data.nfts as Array<{ 
    name: string; 
    collection: string;
    image?: string;
    tokenId?: string;
    contractAddress?: string;
  }> | undefined;
  const collections = data.collections as Record<string, { name: string; count: number }> | undefined;
  const source = data.source as string | undefined;
  const error = data.error as string | undefined;

  if (error === 'NO_API_KEY') {
    return (
      <VStack gap={3} align="stretch">
        <Box p={3} bg="blue.50" borderRadius="md" border="1px solid" borderColor="blue.200">
          <Text fontSize="sm" color="blue.800" fontWeight="semibold">API Key Required</Text>
          <Text fontSize="xs" color="blue.700">
            Add ALCHEMY_API_KEY to your environment to see real NFT metadata and collection information.
          </Text>
        </Box>
        <Link href="https://alchemy.com" target="_blank" rel="noopener noreferrer" color="blue.500" fontSize="sm">
          Get Alchemy API Key ↗
        </Link>
      </VStack>
    );
  }

  return (
    <VStack gap={3} align="stretch">
      {totalCount !== undefined && totalCount > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">Total NFTs:</Text>
          <Text fontSize="lg" fontWeight="bold" color="blue.600">{totalCount}</Text>
        </Box>
      )}

      {collections && Object.keys(collections).length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">Collections ({Object.keys(collections).length}):</Text>
          <VStack gap={1} align="stretch">
            {Object.values(collections).slice(0, 3).map((collection, index) => (
              <HStack key={index} justify="space-between">
                <Text fontSize="sm" color="gray.700" truncate>{collection.name}</Text>
                <Text fontSize="xs" color="gray.500">{collection.count}</Text>
              </HStack>
            ))}
            {Object.keys(collections).length > 3 && (
              <Text fontSize="xs" color="gray.500" textAlign="center">+{Object.keys(collections).length - 3} more collections</Text>
            )}
          </VStack>
        </Box>
      )}

      {nfts && nfts.length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">Recent NFTs:</Text>
          <VStack gap={2} align="stretch">
            {nfts.slice(0, 3).map((nft, index) => (
              <Box key={index} p={2} bg="gray.50" borderRadius="md" border="1px solid" borderColor="gray.200">
                <HStack gap={2}>
                  {nft.image && (
                    <Box width="30px" height="30px" bg="gray.200" borderRadius="md" overflow="hidden">
                      <Image src={nft.image} alt={nft.name} width={30} height={30} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Box>
                  )}
                  <VStack align="start" gap={0} flex={1}>
                    <Text fontSize="xs" fontWeight="semibold" color="gray.800" truncate>{nft.name}</Text>
                    <Text fontSize="xs" color="gray.600" truncate>{nft.collection}</Text>
                  </VStack>
                </HStack>
              </Box>
            ))}
            {nfts.length > 3 && (
              <Text fontSize="xs" color="gray.500" textAlign="center">+{nfts.length - 3} more NFTs</Text>
            )}
          </VStack>
        </Box>
      )}
      
      <HStack justify="space-between" align="center">
        {source && source !== 'none' && (
          <Text fontSize="xs" color="gray.500">Source: {source}</Text>
        )}
      </HStack>
    </VStack>
  );
};

const OpenSeaContent: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const topValuedNFTs = data.topValuedNFTs as Array<{ 
    name: string; 
    collection: string;
    image?: string; 
    floorPrice?: number;
    estimatedValue?: number;
    currency?: string;
    permalink?: string;
    rarity?: string;
  }> | undefined;
  const marketStats = data.marketStats as {
    totalEstimatedValue?: number;
    totalFloorValue?: number;
    uniqueCollections?: number;
    totalNFTs?: number;
    topCollectionsByValue?: Array<{
      name: string;
      count: number;
      floorPrice: number;
      totalValue: number;
    }>;
  } | undefined;
  const portfolioSummary = data.portfolioSummary as {
    totalValue?: number;
    currency?: string;
  } | undefined;
  const profileUrl = data.profileUrl as string | undefined;
  const source = data.source as string | undefined;

  return (
    <VStack gap={3} align="stretch">
      {portfolioSummary?.totalValue !== undefined && portfolioSummary.totalValue > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">Portfolio Value:</Text>
          <HStack>
            <Text fontSize="lg" fontWeight="bold" color="green.600">
              {portfolioSummary.totalValue.toFixed(2)} {portfolioSummary.currency || 'ETH'}
            </Text>
          </HStack>
        </Box>
      )}

      {marketStats && (
        <HStack gap={4}>
          {marketStats.uniqueCollections !== undefined && (
            <Box>
              <Text fontSize="xs" color="gray.600">Collections</Text>
              <Text fontSize="lg" fontWeight="bold" color="blue.600">{marketStats.uniqueCollections}</Text>
            </Box>
          )}
          {marketStats.totalNFTs !== undefined && (
            <Box>
              <Text fontSize="xs" color="gray.600">Total NFTs</Text>
              <Text fontSize="lg" fontWeight="bold" color="purple.600">{marketStats.totalNFTs}</Text>
            </Box>
          )}
        </HStack>
      )}

      {topValuedNFTs && topValuedNFTs.length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">Top Valued NFTs:</Text>
          <VStack gap={2} align="stretch">
            {topValuedNFTs.slice(0, 3).map((nft, index) => (
              <Box key={index} p={2} bg="gray.50" borderRadius="md" border="1px solid" borderColor="gray.200">
                <HStack gap={2}>
                  {nft.image && (
                    <Box width="30px" height="30px" bg="gray.200" borderRadius="md" overflow="hidden">
                      <Image src={nft.image} alt={nft.name} width={30} height={30} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Box>
                  )}
                  <VStack align="start" gap={0} flex={1}>
                    <Text fontSize="xs" fontWeight="semibold" color="gray.800" truncate>{nft.name}</Text>
                    <Text fontSize="xs" color="gray.600" truncate>{nft.collection}</Text>
                    {nft.estimatedValue && (
                      <Text fontSize="xs" color="green.600" fontWeight="semibold">
                        ~{nft.estimatedValue.toFixed(2)} {nft.currency || 'ETH'}
                      </Text>
                    )}
                  </VStack>
                  {nft.rarity && (
                    <Badge size="sm" colorScheme={nft.rarity === 'Ultra Rare' ? 'purple' : nft.rarity === 'Rare' ? 'blue' : 'gray'}>
                      {nft.rarity}
                    </Badge>
                  )}
                </HStack>
                {nft.permalink && (
                  <Link href={nft.permalink} target="_blank" rel="noopener noreferrer" fontSize="xs" color="blue.500" mt={1}>
                    View NFT ↗
                  </Link>
                )}
              </Box>
            ))}
            {topValuedNFTs.length > 3 && (
              <Text fontSize="xs" color="gray.500" textAlign="center">+{topValuedNFTs.length - 3} more NFTs</Text>
            )}
          </VStack>
        </Box>
      )}

      {marketStats?.topCollectionsByValue && marketStats.topCollectionsByValue.length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">Top Collections by Value:</Text>
          <VStack gap={1} align="stretch">
            {marketStats.topCollectionsByValue.slice(0, 3).map((collection, index) => (
              <HStack key={index} justify="space-between">
                <VStack align="start" gap={0}>
                  <Text fontSize="xs" fontWeight="semibold" color="gray.800" truncate>{collection.name}</Text>
                  <Text fontSize="xs" color="gray.600">{collection.count} NFTs</Text>
                </VStack>
                <Text fontSize="xs" color="green.600" fontWeight="semibold">
                  {collection.totalValue.toFixed(1)} ETH
                </Text>
              </HStack>
            ))}
          </VStack>
        </Box>
      )}
      
      <HStack justify="space-between" align="center">
        {source && source !== 'none' && (
          <Text fontSize="xs" color="gray.500">Source: {source}</Text>
        )}
        {profileUrl && (
          <Link href={profileUrl} target="_blank" rel="noopener noreferrer" color="blue.500" fontSize="sm">
            View on OpenSea ↗
          </Link>
        )}
      </HStack>
    </VStack>
  );
};

const IcebreakerContent: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const displayName = data.displayName as string | undefined;
  const bio = data.bio as string | undefined;
  const verifiedChannelsCount = data.verifiedChannelsCount as number | undefined;
  const credentialsCount = data.credentialsCount as number | undefined;
  const profileUrl = data.profileUrl as string | undefined;

  return (
    <VStack gap={3} align="stretch">
      {displayName && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">Display Name:</Text>
          <Text fontSize="md" color="gray.800">{displayName}</Text>
        </Box>
      )}
      
      {bio && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">Bio:</Text>
          <Text fontSize="sm" color="gray.700" truncate>{bio}</Text>
        </Box>
      )}
      
      <HStack gap={4}>
        {verifiedChannelsCount !== undefined && (
          <Box>
            <Text fontSize="xs" color="gray.600">Verified Channels</Text>
            <Text fontSize="lg" fontWeight="bold" color="green.600">{verifiedChannelsCount}</Text>
          </Box>
        )}
        {credentialsCount !== undefined && (
          <Box>
            <Text fontSize="xs" color="gray.600">Credentials</Text>
            <Text fontSize="lg" fontWeight="bold" color="blue.600">{credentialsCount}</Text>
          </Box>
        )}
      </HStack>
      
      {profileUrl && (
        <Link href={profileUrl} target="_blank" rel="noopener noreferrer" color="green.500" fontSize="sm">
          View on Icebreaker ↗
        </Link>
      )}
    </VStack>
  );
};

const HumanPassportContent: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const score = data.score as number | undefined;
  const trustLevel = data.trustLevel as string | undefined;
  const stamps = data.stamps as Array<{ name: string }> | undefined;
  const error = data.error as string | undefined;

  if (error === 'NO_API_ACCESS') {
    return (
      <VStack gap={3} align="stretch">
        <Box p={3} bg="blue.50" borderRadius="md" border="1px solid" borderColor="blue.200">
          <Text fontSize="sm" color="blue.800" fontWeight="semibold">Educational Mode</Text>
          <Text fontSize="xs" color="blue.700">
            Human Passport (formerly Gitcoin Passport) helps verify your humanity and build reputation through various stamps and credentials.
          </Text>
        </Box>
        <Link href="https://passport.xyz" target="_blank" rel="noopener noreferrer" color="blue.500" fontSize="sm">
          Learn about Human Passport ↗
        </Link>
      </VStack>
    );
  }

  return (
    <VStack gap={3} align="stretch">
      {score !== undefined && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">Trust Score:</Text>
          <HStack>
            <Text fontSize="lg" fontWeight="bold" color="blue.600">{score.toFixed(1)}</Text>
            {trustLevel && (
              <Badge colorScheme={trustLevel === 'High' ? 'green' : trustLevel === 'Medium' ? 'yellow' : 'red'}>
                {trustLevel}
              </Badge>
            )}
          </HStack>
        </Box>
      )}
      
      {stamps && stamps.length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">Stamps ({stamps.length}):</Text>
          <VStack gap={1} align="stretch">
            {stamps.slice(0, 3).map((stamp, index) => (
              <Text key={index} fontSize="sm" color="gray.700">{stamp.name}</Text>
            ))}
            {stamps.length > 3 && (
              <Text fontSize="xs" color="gray.500">+{stamps.length - 3} more stamps</Text>
            )}
          </VStack>
        </Box>
      )}
      
      <Link href="https://passport.xyz" target="_blank" rel="noopener noreferrer" color="blue.500" fontSize="sm">
        View on Human Passport ↗
      </Link>
    </VStack>
  );
};

const DecentralandContent: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const landParcels = data.landParcels as number | undefined;
  const wearables = data.wearables as number | undefined;
  const lastActive = data.lastActive as string | undefined;
  const profileUrl = data.profileUrl as string | undefined;

  return (
    <VStack gap={3} align="stretch">
      <HStack gap={4}>
        {landParcels !== undefined && (
          <Box>
            <Text fontSize="xs" color="gray.600">LAND Parcels</Text>
            <Text fontSize="lg" fontWeight="bold" color="green.600">{landParcels}</Text>
          </Box>
        )}
        {wearables !== undefined && (
          <Box>
            <Text fontSize="xs" color="gray.600">Wearables</Text>
            <Text fontSize="lg" fontWeight="bold" color="purple.600">{wearables}</Text>
          </Box>
        )}
      </HStack>
      
      {lastActive && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">Last Active:</Text>
          <Text fontSize="sm" color="gray.700">{new Date(lastActive).toLocaleDateString()}</Text>
        </Box>
      )}
      
      {profileUrl && (
        <Link href={profileUrl} target="_blank" rel="noopener noreferrer" color="green.500" fontSize="sm">
          View in Decentraland ↗
        </Link>
      )}
    </VStack>
  );
};

const DeBankContent: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const totalUSD = data.totalUSD as number | undefined;
  const totalTokens = data.totalTokens as number | undefined;
  const totalProtocols = data.totalProtocols as number | undefined;
  const topTokens = data.topTokens as Array<{
    symbol: string;
    name: string;
    amount: number;
    usdValue: number;
    price: number;
    logoUrl?: string;
  }> | undefined;
  const protocolPositions = data.protocolPositions as Array<{
    name: string;
    category: string;
    usdValue: number;
    positionType: string;
    logoUrl?: string;
  }> | undefined;
  const portfolioUrl = data.portfolioUrl as string | undefined;
  const source = data.source as string | undefined;

  return (
    <VStack gap={3} align="stretch">
      {totalUSD !== undefined && totalUSD > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">Portfolio Value:</Text>
          <Text fontSize="xl" fontWeight="bold" color="green.600">
            ${totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </Box>
      )}

      <HStack gap={4}>
        {totalTokens !== undefined && (
          <Box>
            <Text fontSize="xs" color="gray.600">Tokens</Text>
            <Text fontSize="lg" fontWeight="bold" color="blue.600">{totalTokens}</Text>
          </Box>
        )}
        {totalProtocols !== undefined && (
          <Box>
            <Text fontSize="xs" color="gray.600">DeFi Protocols</Text>
            <Text fontSize="lg" fontWeight="bold" color="purple.600">{totalProtocols}</Text>
          </Box>
        )}
      </HStack>

      {topTokens && topTokens.length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">Top Holdings:</Text>
          <VStack gap={2} align="stretch">
            {topTokens.slice(0, 3).map((token, index) => (
              <Box key={index} p={2} bg="gray.50" borderRadius="md" border="1px solid" borderColor="gray.200">
                <HStack gap={2}>
                  {token.logoUrl && (
                    <Box width="20px" height="20px" bg="gray.200" borderRadius="full" overflow="hidden">
                      <Image src={token.logoUrl} alt={token.symbol} width={20} height={20} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Box>
                  )}
                  <VStack align="start" gap={0} flex={1}>
                    <HStack justify="space-between" width="100%">
                      <Text fontSize="xs" fontWeight="semibold" color="gray.800">{token.symbol}</Text>
                      <Text fontSize="xs" color="green.600" fontWeight="semibold">
                        ${token.usdValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </Text>
                    </HStack>
                    <Text fontSize="xs" color="gray.600">
                      {token.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} @ ${token.price.toLocaleString()}
                    </Text>
                  </VStack>
                </HStack>
              </Box>
            ))}
            {topTokens.length > 3 && (
              <Text fontSize="xs" color="gray.500" textAlign="center">+{topTokens.length - 3} more tokens</Text>
            )}
          </VStack>
        </Box>
      )}

      {protocolPositions && protocolPositions.length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">DeFi Positions:</Text>
          <VStack gap={1} align="stretch">
            {protocolPositions.slice(0, 3).map((position, index) => (
              <HStack key={index} justify="space-between">
                <HStack gap={2}>
                  {position.logoUrl && (
                    <Box width="16px" height="16px" bg="gray.200" borderRadius="sm" overflow="hidden">
                      <Image src={position.logoUrl} alt={position.name} width={16} height={16} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Box>
                  )}
                  <VStack align="start" gap={0}>
                    <Text fontSize="xs" fontWeight="semibold" color="gray.800">{position.name}</Text>
                    <Badge size="xs" colorScheme={position.category === 'Lending' ? 'blue' : position.category === 'Staking' ? 'green' : 'purple'}>
                      {position.positionType}
                    </Badge>
                  </VStack>
                </HStack>
                <Text fontSize="xs" color="green.600" fontWeight="semibold">
                  ${position.usdValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </Text>
              </HStack>
            ))}
            {protocolPositions.length > 3 && (
              <Text fontSize="xs" color="gray.500" textAlign="center">+{protocolPositions.length - 3} more positions</Text>
            )}
          </VStack>
        </Box>
      )}
      
      <HStack justify="space-between" align="center">
        {source && source !== 'none' && (
          <Text fontSize="xs" color="gray.500">Source: {source}</Text>
        )}
        {portfolioUrl && (
          <Link href={portfolioUrl} target="_blank" rel="noopener noreferrer" color="blue.500" fontSize="sm">
            View on DeBank ↗
          </Link>
        )}
      </HStack>
    </VStack>
  );
};

// Export individual fast service cards
export const FastENSCard: React.FC<{ data: Record<string, unknown> | null; loading?: boolean }> = ({ data, loading }) => (
  <ServiceCard data={data} loading={loading} serviceName="ENS" icon="🏷️" />
);

export const FastFarcasterCard: React.FC<{ data: Record<string, unknown> | null; loading?: boolean }> = ({ data, loading }) => (
  <ServiceCard data={data} loading={loading} serviceName="Farcaster" icon="🟣" />
);

export const FastAlchemyCard: React.FC<{ data: Record<string, unknown> | null; loading?: boolean }> = ({ data, loading }) => (
  <ServiceCard data={data} loading={loading} serviceName="Alchemy" icon="⚗️" />
);

export const FastOpenSeaCard: React.FC<{ data: Record<string, unknown> | null; loading?: boolean }> = ({ data, loading }) => (
  <ServiceCard data={data} loading={loading} serviceName="OpenSea" icon="🌊" />
);

export const FastIcebreakerCard: React.FC<{ data: Record<string, unknown> | null; loading?: boolean }> = ({ data, loading }) => (
  <ServiceCard data={data} loading={loading} serviceName="Icebreaker" icon="🧊" />
);

export const FastHumanPassportCard: React.FC<{ data: Record<string, unknown> | null; loading?: boolean }> = ({ data, loading }) => (
  <ServiceCard data={data} loading={loading} serviceName="Human Passport" icon="🎫" />
);

export const FastDecentralandCard: React.FC<{ data: Record<string, unknown> | null; loading?: boolean }> = ({ data, loading }) => (
  <ServiceCard data={data} loading={loading} serviceName="Decentraland" icon="🏗️" />
);

export const FastDeBankCard: React.FC<{ data: Record<string, unknown> | null; loading?: boolean }> = ({ data, loading }) => (
  <ServiceCard data={data} loading={loading} serviceName="DeBank" icon="💰" />
); 