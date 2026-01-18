import { withPayload } from '@payloadcms/next/withPayload'
import { getPayloadUIAliases } from '../../scripts/payload-ui-aliases.mjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',
  
  // SEO and Performance optimizations
  poweredByHeader: false,
  compress: true,

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 144, 256, 384, 600],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: (() => {
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://brugrappling.ie'
      const urls = serverUrl.split(',').map((url) => url.trim()).filter(Boolean)
      return urls.map((url) => {
        try {
          const parsedUrl = new URL(url)
          return {
            hostname: parsedUrl.hostname,
            protocol: parsedUrl.protocol.replace(':', ''),
          }
        } catch {
          return null
        }
      }).filter(Boolean)
    })(),
  },

  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      {
        source: '/_next/image(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/media/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/sitemap.xml',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/xml',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=86400',
          },
        ],
      },
    ]
  },

  // Experimental features for better performance
  // NOTE: `optimizePackageImports` has caused Next.js build crashes in this monorepo
  // (uncaughtException reading `length`). Keep it opt-in.
  experimental:
    process.env.NEXT_OPTIMIZE_PACKAGE_IMPORTS === 'true'
      ? {
          optimizePackageImports: ['@repo/ui', '@repo/shared-types'],
        }
      : {},

  // Ensure workspace packages used by Payload admin importMap are transpiled
  transpilePackages: ['@repo/ui', '@repo/bookings-plugin', '@repo/memberships', '@repo/payments-plugin'],

  // Ensure pnpm symlinks are resolved to real paths so React context isn't duplicated
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
