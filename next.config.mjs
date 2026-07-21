import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.NODE_ENV === 'development') {
  const localDatabaseUrl =
    process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (localDatabaseUrl) {
    process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ??= localDatabaseUrl;
  }
  initOpenNextCloudflareForDev();
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  // OpenNext copies the complete package for dependencies that expose a
  // workerd-specific conditional export. Next's standalone tracer otherwise
  // keeps only the Node branch and the Worker bundle cannot resolve it.
  serverExternalPackages: [
    '@prisma/client',
    '.prisma/client',
    '@emotion/cache',
    '@emotion/react',
    '@emotion/styled',
    '@emotion/use-insertion-effect-with-fallbacks',
    '@emotion/utils',
    'isows',
  ],
  images: {
    remotePatterns: [
      'assets.coingecko.com',
      'gateway.pinata.cloud',
      'ipfs.io',
      'i.seadn.io',
      'openseauserdata.com',
      'peer.decentraland.org',
      'profile.decentraland.org',
      'api.decentraland.org',
      'euc.li',
      'static.debank.com',
      'debank.com',
      'i2c.seadn.io',
    ].map((hostname) => ({
      protocol: 'https',
      hostname,
    })),
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(test|spec)\.(ts|tsx|js|jsx)$/,
      loader: 'ignore-loader',
    });

    return config;
  },
};

export default nextConfig;
