export type ColorMode = 'light' | 'dark';

export const COLOR_MODE_STORAGE_KEY = 'crypto-me-color-mode';

export function getToggleTargetColorMode(resolvedTheme: string | undefined): ColorMode {
  return resolvedTheme === 'dark' ? 'light' : 'dark';
}
