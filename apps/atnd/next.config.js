import { withPayload } from '@payloadcms/next/withPayload'
import { createRequire } from 'module'
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

    const payloadUiEntry = require.resolve('@payloadcms/ui')
    const marker = `${path.sep}@payloadcms${path.sep}ui${path.sep}`
    const markerIdx = payloadUiEntry.lastIndexOf(marker)
    const payloadUiDir =
      markerIdx === -1 ? path.dirname(payloadUiEntry) : payloadUiEntry.slice(0, markerIdx + marker.length)
    webpackConfig.resolve.alias = {
      ...(webpackConfig.resolve.alias || {}),
      '@payloadcms/ui$': require.resolve('@payloadcms/ui'),
      '@payloadcms/ui/shared$': require.resolve('@payloadcms/ui/shared'),
      '@payloadcms/ui/': payloadUiDir,
    }

    return webpackConfig
  },
  reactStrictMode: true,
  redirects,
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
