/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/:ens',
        destination: '/[ens]',
      },
    ];
  },
};

export default nextConfig;
