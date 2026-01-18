import { withPayload } from '@payloadcms/next/withPayload'
import { createRequire } from 'module'
import fs from 'node:fs'
import path from 'node:path'

import redirects from './redirects.js'

const require = createRequire(import.meta.url)

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined || process.env.__NEXT_PRIVATE_ORIGIN || 'http://localhost:3000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL /* 'https://example.com' */].map((item) => {
        const url = new URL(item)

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', ''),
        }
      }),
    ],
  },
  transpilePackages: ['@repo/ui', '@repo/bookings-plugin', '@repo/memberships', '@repo/payments-plugin'],
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    webpackConfig.resolve.symlinks = true

    const workspaceRoot = path.resolve(process.cwd(), '../..')
    const pnpmVirtualStoreUiDir = path.join(workspaceRoot, 'node_modules/.pnpm/node_modules/@payloadcms/ui')

    let payloadUiDir
    const payloadNextEntry = require.resolve('@payloadcms/next/withPayload')
    const nextMarker = `${path.sep}@payloadcms${path.sep}next${path.sep}`
    const nextMarkerIdx = payloadNextEntry.lastIndexOf(nextMarker)
    const payloadNextDir =
      nextMarkerIdx === -1
        ? path.dirname(payloadNextEntry)
        : payloadNextEntry.slice(0, nextMarkerIdx + nextMarker.length)
    const payloadUiFromNextDir = path.join(path.dirname(payloadNextDir), 'ui')

    if (fs.existsSync(payloadUiFromNextDir)) {
      payloadUiDir = fs.realpathSync(payloadUiFromNextDir)
    } else if (fs.existsSync(pnpmVirtualStoreUiDir)) {
      payloadUiDir = fs.realpathSync(pnpmVirtualStoreUiDir)
    } else {
      const payloadUiEntry = require.resolve('@payloadcms/ui')
      const marker = `${path.sep}@payloadcms${path.sep}ui${path.sep}`
      const markerIdx = payloadUiEntry.lastIndexOf(marker)
      payloadUiDir =
        markerIdx === -1 ? path.dirname(payloadUiEntry) : payloadUiEntry.slice(0, markerIdx + marker.length)
    }

    const payloadUiEntryFile = path.join(payloadUiDir, 'dist/exports/client/index.js')
    const payloadUiSharedEntryFile = path.join(payloadUiDir, 'dist/exports/shared/index.js')
    const payloadUiRscEntryFile = path.join(payloadUiDir, 'dist/exports/rsc/index.js')
    const payloadUiDistDir = path.join(payloadUiDir, 'dist')
    webpackConfig.resolve.alias = {
      ...(webpackConfig.resolve.alias || {}),
      '@payloadcms/ui$': payloadUiEntryFile,
      '@payloadcms/ui/shared$': payloadUiSharedEntryFile,
      '@payloadcms/ui/rsc$': payloadUiRscEntryFile,
      '@payloadcms/ui/dist/': `${payloadUiDistDir}${path.sep}`,
      '@payloadcms/ui/': `${payloadUiDistDir}${path.sep}`,
    }

    return webpackConfig
  },
  reactStrictMode: true,
  redirects,
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
