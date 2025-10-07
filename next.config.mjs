/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['postgres']
  },
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        perf_hooks: false,
      };
    }
    
    // Ensure secure webpack configuration for production
    if (!dev) {
      config.devtool = false;
      config.optimization = {
        ...config.optimization,
        minimize: true,
      };
    }
    
    return config;
  },
};

export default nextConfig;
