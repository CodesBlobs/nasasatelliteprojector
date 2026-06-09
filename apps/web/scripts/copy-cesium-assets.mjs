import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

let cesiumBuild
try {
  const cesiumPkg = require.resolve('cesium/package.json')
  cesiumBuild = resolve(dirname(cesiumPkg), 'Build', 'Cesium')
} catch {
  console.warn('[cesium] Package not found, skipping asset copy')
  process.exit(0)
}

if (!existsSync(cesiumBuild)) {
  console.warn('[cesium] Build directory not found at:', cesiumBuild)
  process.exit(0)
}

const dest = resolve(__dirname, '..', 'public', 'cesium')
mkdirSync(dest, { recursive: true })

for (const dir of ['Workers', 'Assets', 'ThirdParty', 'Widgets']) {
  const src = resolve(cesiumBuild, dir)
  if (existsSync(src)) {
    cpSync(src, resolve(dest, dir), { recursive: true })
  }
}

console.log('[cesium] Assets copied to public/cesium/')
