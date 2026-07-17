import { createRequire } from 'node:module'

import { withSentryConfig } from '@sentry/nextjs'
import { withPayload } from '@payloadcms/next/withPayload'
import { getPayloadUIAliases } from '../../scripts/payload-ui-aliases.mjs'

import redirects from './redirects.js'

const require = createRequire(import.meta.url)

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined || process.env.__NEXT_PRIVATE_ORIGIN || 'http://localhost:3000'

/** @returns {{ hostname: string, protocol: string } | null} */
function remotePatternFromUrl(value) {
  if (!value) return null
  try {
    const url = new URL(value)
    return {
      hostname: url.hostname,
      protocol: url.protocol.replace(':', ''),
    }
  } catch {
    return null
  }
}

const imageRemotePatterns = [
  remotePatternFromUrl(NEXT_PUBLIC_SERVER_URL),
  remotePatternFromUrl(process.env.R2_PUBLIC_URL),
  remotePatternFromUrl(process.env.NEXT_PUBLIC_R2_PUBLIC_URL),
  // Local / tenant hosts that may appear on absolute media URLs
  { hostname: 'localhost', protocol: 'http' },
  { hostname: 'atnd.me', protocol: 'https' },
  { hostname: '**.atnd.me', protocol: 'https' },
  { hostname: '**.r2.dev', protocol: 'https' },
].filter(Boolean)

// CI e2e uses a normal `.next` build + `next start` so sharp/react resolve from the
// workspace install. Standalone stays the default for deploy/self-host.
const useStandaloneOutput = process.env.E2E_DISABLE_STANDALONE !== 'true'

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(useStandaloneOutput
    ? {
        output: 'standalone',
        // Ensure sharp platform binaries + runtime deps are present in standalone traces (pnpm).
        // Dockerfile also copies @img/detect-libc beside sharp; keep both for local standalone.
        outputFileTracingIncludes: {
          '/**': [
            './node_modules/sharp/**/*',
            './node_modules/@img/**/*',
            './node_modules/detect-libc/**/*',
            '../../node_modules/.pnpm/@img+sharp-linuxmusl-*/**/*',
            '../../node_modules/.pnpm/@img+sharp-libvips-linuxmusl-*/**/*',
          ],
        },
      }
    : {}),
  // Required for standalone: Sentry/OpenTelemetry (Payload admin) load require-in-the-middle at
  // runtime; Next does not trace it, so include it so the package is present in standalone output.
  serverExternalPackages: ['require-in-the-middle', 'sharp'],
  // Required so Next can compile workspace TS sources used at runtime.
  // Without this, Node will try to resolve deep imports like
  // `@repo/bookings-plugin/src/...` directly from `node_modules`, which fails in ESM.
  transpilePackages: ['payload-auth', '@repo/bookings-plugin', '@repo/bookings-payments'],
  images: {
    remotePatterns: imageRemotePatterns,
    // Allow unoptimized images for subdomains (fallback if remotePatterns don't match)
    // This allows images from any hostname, including subdomains
    unoptimized: false,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  webpack: (webpackConfig, options) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    webpackConfig.resolve.alias = {
      ...(webpackConfig.resolve.alias || {}),
      ...getPayloadUIAliases({ from: import.meta.url, cwd: process.cwd() }),
    }

    // Client compile only: analyzing server bundles with `output: 'standalone'` yields missing-file
    // warnings after traces move chunks. Report: `.next/analyze/client.html`.
    if (process.env.ANALYZE === 'true' && !options.isServer) {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
      webpackConfig.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: process.env.ANALYZE_OPEN === 'true',
          reportFilename: './analyze/client.html',
        }),
      )
    }

    return webpackConfig
  },
  reactStrictMode: true,
  redirects,
}

const payloadWrapped = withPayload(nextConfig, { devBundleServerPackages: true })

// Build-time Sentry webpack plugin (source map upload) is optional and can be disabled.
// This also prevents local/E2E builds from invoking native Sentry tooling.
const enableSentryWebpack =
  process.env.DISABLE_SENTRY !== 'true' && Boolean(process.env.SENTRY_AUTH_TOKEN)

const nextConfigFinal = enableSentryWebpack
  ? withSentryConfig(payloadWrapped, {
      // For all available options, see:
      // https://www.npmjs.com/package/@sentry/webpack-plugin#options

      org: 'atnd',
      project: 'javascript-nextjs',

      // Only print logs for uploading source maps in CI
      silent: !process.env.CI,

      // For all available options, see:
      // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

      // Upload a larger set of source maps for prettier stack traces (increases build time)
      widenClientFileUpload: true,

      // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
      tunnelRoute: '/monitoring',

      webpack: {
        automaticVercelMonitors: true,
        treeshake: {
          removeDebugLogging: true,
        },
      },
    })
  : payloadWrapped

export default nextConfigFinal
