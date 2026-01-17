import { withPayload } from '@payloadcms/next/withPayload'
import { createRequire } from 'module'
import path from 'node:path'

const require = createRequire(import.meta.url)

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your Next.js config here
  transpilePackages: ['@repo/ui', '@repo/bookings-plugin', '@repo/memberships', '@repo/payments-plugin'],
  webpack: (webpackConfig) => {
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
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
