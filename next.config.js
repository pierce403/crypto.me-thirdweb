/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['example.com', 'www.gravatar.com'],
  },
};

module.exports = nextConfig;
