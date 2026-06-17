import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['cesium'],
  images: {
    unoptimized: true,
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

