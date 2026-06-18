import path from 'path'
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

      // Cesium's ThirdParty files contain octal escape sequences in template
      // literals which are a syntax error in strict mode. Run them through a
      // custom loader that rewrites the octals to unicode escapes before SWC
      // sees them.
      config.module.rules.unshift({
        test: /google-earth-dbroot-parser\.js$/,
        loader: path.resolve('./octal-escape-loader.cjs'),
      })
    }
    return config
  },
}

export default config

