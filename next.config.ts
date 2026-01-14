import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },

  webpack: (config) => {
    config.externals = {
      ...(config.externals || {}),
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
    }
    return config
  },

  turbopack: {
    root: process.cwd(),
  },
}

export default nextConfig
