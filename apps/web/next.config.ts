import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Cesium uses eval() in some workers — allow it in client bundle
      config.module = config.module ?? {}
      config.module.unknownContextCritical = false
    }
    return config
  },
}

export default config

