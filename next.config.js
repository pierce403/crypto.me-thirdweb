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
      'api.decentraland.org'
    ],
  },
};

module.exports = nextConfig;
