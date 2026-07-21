import type { PropsWithChildren } from 'react';
import { Button, ClientOnly, HStack, Skeleton, Text } from '@chakra-ui/react';
import { ThemeProvider, useTheme } from 'next-themes';
import { COLOR_MODE_STORAGE_KEY, getToggleTargetColorMode } from '../lib/colorMode';

export function ColorModeProvider({ children }: PropsWithChildren) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      enableColorScheme
      disableTransitionOnChange
      storageKey={COLOR_MODE_STORAGE_KEY}
      scriptProps={{ 'data-cfasync': 'false' }}
    >
      {children}
    </ThemeProvider>
  );
}

function ColorModeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const targetTheme = getToggleTargetColorMode(resolvedTheme);
  const label = `Switch to ${targetTheme} mode`;

  return (
    <Button
      type="button"
      data-testid="color-mode-toggle"
      aria-label={label}
      title={label}
      onClick={() => setTheme(targetTheme)}
      variant="outline"
      size="sm"
      minW={{ base: '44px', sm: '88px' }}
      h="44px"
      px={{ base: 2, sm: 3 }}
      bg="bg.panel"
      color="fg"
      borderColor="border"
      _hover={{ bg: 'bg.muted' }}
    >
      <HStack gap={2}>
        <Text aria-hidden="true" fontSize="lg" lineHeight="1">
          {targetTheme === 'dark' ? '☾' : '☀'}
        </Text>
        <Text display={{ base: 'none', sm: 'inline' }}>
          {targetTheme === 'dark' ? 'Dark' : 'Light'}
        </Text>
      </HStack>
    </Button>
  );
}

export function ColorModeToggle() {
  return (
    <ClientOnly fallback={<Skeleton width={{ base: '44px', sm: '88px' }} height="44px" borderRadius="md" />}>
      <ColorModeButton />
    </ClientOnly>
  );
}
