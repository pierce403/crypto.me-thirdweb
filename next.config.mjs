/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove the rewrites section as we'll handle routing directly
  
  // Exclude test files from production build
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
  
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
