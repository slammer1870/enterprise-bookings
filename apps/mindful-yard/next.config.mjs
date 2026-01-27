import { withPayload } from '@payloadcms/next/withPayload'
import { getPayloadUIAliases } from '../../scripts/payload-ui-aliases.mjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your Next.js config here
  transpilePackages: ['@repo/ui', '@repo/bookings-plugin', '@repo/bookings-payments'],
  webpack: (webpackConfig) => {
    webpackConfig.resolve.symlinks = true

    webpackConfig.resolve.alias = {
      ...(webpackConfig.resolve.alias || {}),
      ...getPayloadUIAliases({ from: import.meta.url, cwd: process.cwd() }),
    }

    return webpackConfig
  },
}

export default withPayload(nextConfig)
