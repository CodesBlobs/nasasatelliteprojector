import type { NextConfig } from 'next'

const API_ORIGIN = process.env.API_ORIGIN || 'http://localhost:3001'

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_ORIGIN}/:path*`,
      },
    ]
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.module = config.module ?? {}
      config.module.unknownContextCritical = false
    }
    return config
  },
}

export default config

