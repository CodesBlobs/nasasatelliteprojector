import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const origin = process.env.API_ORIGIN
    if (!origin) return []
    return [
      {
        source: '/api/:path*',
        destination: `${origin}/:path*`,
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

