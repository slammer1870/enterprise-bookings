import { withPayload } from '@payloadcms/next/withPayload'
import { createRequire } from 'module'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)

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

    // Force a single physical @payloadcms/ui instance across the whole bundle.
    // Without this, pnpm can install multiple "@payloadcms/ui@same-version" copies
    // due to differing optional peer sets, leading to React context mismatches
    // (e.g. `useConfig()` returning undefined).
    // In pnpm workspaces, `@payloadcms/ui` is often only resolvable via pnpm's injected NODE_PATH
    // (node_modules/.pnpm/node_modules). Next's webpack resolver can end up bundling multiple peer-variants
    // of @payloadcms/ui, causing missing context providers (e.g. list sort context -> `{ sort }` crash).
    //
    // Prefer pinning to pnpm's single virtual-store symlink if present.
    const workspaceRoot = path.resolve(process.cwd(), '../..')
    const pnpmVirtualStoreUiDir = path.join(workspaceRoot, 'node_modules/.pnpm/node_modules/@payloadcms/ui')

    // Resolve to a real path so webpack doesn't treat symlink + realpath as two modules.
    let payloadUiDir

    // Prefer the exact UI instance that @payloadcms/next is linked to (it depends on @payloadcms/ui),
    // to avoid pnpm peer-variant splits between payload-next and our app.
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
      payloadUiDir = fs.realpathSync(pnpmVirtualStoreUiDir)
    }

    if (!fs.existsSync(payloadUiDir)) {
      // Fallback: derive the directory from Node resolution (works when @payloadcms/ui is directly resolvable)
      const payloadUiEntry = require.resolve('@payloadcms/ui')
      const marker = `${path.sep}@payloadcms${path.sep}ui${path.sep}`
      const markerIdx = payloadUiEntry.lastIndexOf(marker)
      payloadUiDir = markerIdx === -1 ? path.dirname(payloadUiEntry) : payloadUiEntry.slice(0, markerIdx + marker.length)
    }

    const payloadUiEntryFile = path.join(payloadUiDir, 'dist/exports/client/index.js')
    const payloadUiSharedEntryFile = path.join(payloadUiDir, 'dist/exports/shared/index.js')
    const payloadUiRscEntryFile = path.join(payloadUiDir, 'dist/exports/rsc/index.js')
    const payloadUiDistDir = path.join(payloadUiDir, 'dist')

    webpackConfig.resolve.alias = {
      ...(webpackConfig.resolve.alias || {}),
      // Pin both exact imports used by @payloadcms/next and other deps
      '@payloadcms/ui/shared$': payloadUiSharedEntryFile,
      // RSC export used by Payload importMap (admin importMap in App Router)
      '@payloadcms/ui/rsc$': payloadUiRscEntryFile,
      '@payloadcms/ui$': payloadUiEntryFile,
      // Force subpath imports to resolve into the same physical package *and* map
      // @payloadcms/ui/<subpath> -> <pkg>/dist/<subpath>
      // while keeping @payloadcms/ui/dist/<...> -> <pkg>/dist/<...>
      '@payloadcms/ui/dist/': `${payloadUiDistDir}${path.sep}`,
      '@payloadcms/ui/': `${payloadUiDistDir}${path.sep}`,
    }

    return webpackConfig
  },
}

export default withPayload(nextConfig)
