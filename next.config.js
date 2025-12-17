/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@xmtp/node-bindings'],
  images: {
    domains: [
      'gateway.pinata.cloud',
      'i.seadn.io',
      'openseauserdata.com',
      'peer.decentraland.org',
      'profile.decentraland.org',
      'api.decentraland.org',
      'assets.coingecko.com',
      'ipfs.io',
      'euc.li',
      'static.debank.com',
      'debank.com',
      'i2c.seadn.io'
    ],
  },
};

module.exports = nextConfig;
