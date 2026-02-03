import { withPayload } from '@payloadcms/next/withPayload'
import { getPayloadUIAliases } from '../../scripts/payload-ui-aliases.mjs'

import redirects from './redirects.js'

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined || process.env.__NEXT_PRIVATE_ORIGIN || 'http://localhost:3000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required so Next can compile workspace TS sources used at runtime.
  // Without this, Node will try to resolve deep imports like
  // `@repo/bookings-plugin/src/...` directly from `node_modules`, which fails in ESM.
  transpilePackages: ['payload-auth', '@repo/bookings-plugin', '@repo/bookings-payments'],
  images: {
    remotePatterns: [
      // Add the main server URL
      ...[NEXT_PUBLIC_SERVER_URL].map((item) => {
        const url = new URL(item)

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', ''),
        }
      }),
      // For development: Allow localhost (exact match)
      {
        hostname: 'localhost',
        protocol: 'http',
      },
    ],
    // Allow unoptimized images for subdomains (fallback if remotePatterns don't match)
    // This allows images from any hostname, including subdomains
    unoptimized: false,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    webpackConfig.resolve.alias = {
      ...(webpackConfig.resolve.alias || {}),
      ...getPayloadUIAliases({ from: import.meta.url, cwd: process.cwd() }),
    }

    return webpackConfig
  },
  reactStrictMode: true,
  redirects,
}

export default withPayload(nextConfig, { devBundleServerPackages: true })
