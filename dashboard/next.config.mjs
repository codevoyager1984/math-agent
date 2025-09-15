import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default withBundleAnalyzer({
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
    // 允许更长的请求处理时间
    serverMinification: false,
    // 禁用默认的超时限制
    isrFlushToDisk: false,
    proxyTimeout: 1200000
  },
  // 配置服务器选项以移除超时限制
  serverRuntimeConfig: {
    // 这里可以设置服务器端的配置
  },
  // 配置API路由的超时时间
  api: {
    // 移除响应大小限制
    responseLimit: false,
    // 设置超时时间 (单位：毫秒)
    timeout: 600000, // 10分钟
  },
  async rewrites() {
    const ragServerUrl = process.env.RAG_SERVER_URL || 'http://localhost:8000';
    console.log('ragServerUrl', ragServerUrl);
    return [
      {
        source: '/api/:path*',
        destination: `${ragServerUrl}/api/:path*`
      },
    ];
  },
});
