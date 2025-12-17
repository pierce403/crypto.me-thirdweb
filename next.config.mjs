/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove the rewrites section as we'll handle routing directly

  // Exclude test files from production build
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.coingecko.com',
      },
      {
        protocol: 'https',
        hostname: 'gateway.pinata.cloud',
      },
      {
        protocol: 'https',
        hostname: 'ipfs.io',
      },
    ],
  },

  webpack: (config, { isServer }) => {
    // Exclude test files from build
    config.module.rules.push({
      test: /\.(test|spec)\.(ts|tsx|js|jsx)$/,
      loader: 'ignore-loader'
    });

    return config;
  }
};

export default nextConfig;
