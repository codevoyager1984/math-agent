import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    ppr: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
      {
        hostname: '*.aliyuncs.com',
      },
    ],
  },
};

export default nextConfig;
