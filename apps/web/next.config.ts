import path from 'path'
import type { NextConfig } from 'next'

const { fixOctals } = require('./octal-escape-loader.cjs')

class FixOctalsPlugin {
  apply(compiler: any) {
    compiler.hooks.compilation.tap('FixOctalsPlugin', (compilation: any) => {
      compilation.hooks.processAssets.tap(
        { name: 'FixOctalsPlugin', stage: 400 },
        (assets: Record<string, any>) => {
          for (const [filename, asset] of Object.entries(assets)) {
            if (!filename.endsWith('.js')) continue
            const original: string = asset.source()
            const fixed: string = fixOctals(original)
            if (fixed !== original) {
              compilation.updateAsset(
                filename,
                new (require('webpack').sources.RawSource)(fixed),
              )
            }
          }
        },
      )
    })
  }
}

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['cesium'],
  images: { unoptimized: true },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.module = config.module ?? {}
      config.module.unknownContextCritical = false

      config.module.rules.unshift({
        test: /node_modules[\\/]cesium[\\/].*\.js$/,
        loader: path.join(__dirname, 'octal-escape-loader.cjs'),
      })

      config.plugins.push(new FixOctalsPlugin())
    }
    return config
  },
}

export default config
