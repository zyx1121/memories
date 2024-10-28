import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'r2.memories.zhanyongxiang.com',
        port: '',
        pathname: '/images/**',
      },
    ],
  },
};

export default nextConfig;
