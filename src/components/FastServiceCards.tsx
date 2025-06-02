import React from 'react';
import { Box, Text, VStack, HStack, Badge, Link, Image, Spinner } from '@chakra-ui/react';

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
  if (loading) {
    return (
      <Box p={6} bg="white" borderRadius="lg" boxShadow="md" border="1px solid" borderColor="gray.200">
        <VStack gap={4} align="stretch">
          <HStack justify="space-between">
            <HStack>
              {icon && <Text fontSize="2xl">{icon}</Text>}
              <Text fontSize="lg" fontWeight="bold" color="gray.800">{serviceName}</Text>
            </HStack>
            <Spinner size="sm" />
          </HStack>
          <Text fontSize="sm" color="gray.600">Loading...</Text>
        </VStack>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box p={6} bg="white" borderRadius="lg" boxShadow="md" border="1px solid" borderColor="gray.200">
        <VStack gap={4} align="stretch">
          <HStack>
            {icon && <Text fontSize="2xl">{icon}</Text>}
            <Text fontSize="lg" fontWeight="bold" color="gray.800">{serviceName}</Text>
          </HStack>
          <Text fontSize="sm" color="gray.500">
            {description || `No ${serviceName.toLowerCase()} data available`}
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box p={6} bg="white" borderRadius="lg" boxShadow="md" border="1px solid" borderColor="gray.200">
      <VStack gap={4} align="stretch">
        <HStack justify="space-between">
          <HStack>
            {icon && <Text fontSize="2xl">{icon}</Text>}
            <Text fontSize="lg" fontWeight="bold" color="gray.800">{serviceName}</Text>
          </HStack>
          <Badge colorScheme="green" size="sm">Active</Badge>
        </HStack>
        
        {serviceName === 'ENS' && <ENSContent data={data} />}
        {serviceName === 'Farcaster' && <FarcasterContent data={data} />}
        {serviceName === 'OpenSea' && <OpenSeaContent data={data} />}
        {serviceName === 'Icebreaker' && <IcebreakerContent data={data} />}
        {serviceName === 'Human Passport' && <HumanPassportContent data={data} />}
        {serviceName === 'Decentraland' && <DecentralandContent data={data} />}
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
          <Image src={avatar} alt="ENS Avatar" maxH="80px" borderRadius="md" />
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

const OpenSeaContent: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const topNFTs = data.topNFTs as Array<{ name: string; image?: string; collection?: string }> | undefined;
  const totalValue = data.totalValue as number | undefined;
  const profileUrl = data.profileUrl as string | undefined;
  const source = data.source as string | undefined;

  return (
    <VStack gap={3} align="stretch">
      {totalValue !== undefined && totalValue > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">Portfolio Value:</Text>
          <Text fontSize="lg" fontWeight="bold" color="blue.600">{totalValue.toFixed(4)} ETH</Text>
        </Box>
      )}
      
      {topNFTs && topNFTs.length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.600">Top NFTs:</Text>
          <VStack gap={1} align="stretch">
            {topNFTs.slice(0, 3).map((nft, index) => (
              <Text key={index} fontSize="sm" color="gray.700" truncate>
                {nft.collection || 'Unknown'}: {nft.name}
              </Text>
            ))}
            {topNFTs.length > 3 && (
              <Text fontSize="xs" color="gray.500">+{topNFTs.length - 3} more NFTs</Text>
            )}
          </VStack>
        </Box>
      )}
      
      {source && (
        <Text fontSize="xs" color="gray.500">Source: {source}</Text>
      )}
      
      {profileUrl && (
        <Link href={profileUrl} target="_blank" rel="noopener noreferrer" color="blue.500" fontSize="sm">
          View on OpenSea ↗
        </Link>
      )}
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

// Export individual fast service cards
export const FastENSCard: React.FC<{ data: Record<string, unknown> | null; loading?: boolean }> = ({ data, loading }) => (
  <ServiceCard data={data} loading={loading} serviceName="ENS" icon="🏷️" />
);

export const FastFarcasterCard: React.FC<{ data: Record<string, unknown> | null; loading?: boolean }> = ({ data, loading }) => (
  <ServiceCard data={data} loading={loading} serviceName="Farcaster" icon="🟣" />
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