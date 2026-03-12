import { postgresAdapter } from '@payloadcms/db-postgres'
import sharp from 'sharp'
import path from 'path'
import { buildConfig, PayloadRequest, SharpDependency } from 'payload'
import { fileURLToPath } from 'url'

import { Categories } from './collections/Categories'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Users } from './collections/Users'
import { Tenants } from './collections/Tenants'
import { DiscountCodes } from './collections/DiscountCodes'
import { Navbar } from './collections/Navbar'
import { Footer } from './collections/Footer'
import { Scheduler } from './collections/Scheduler'
import { PlatformFees } from './globals/PlatformFees'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'
import { generateLessonsFromScheduleWithTenant } from './tasks/generate-lessons-with-tenant'
import { createCustomersProxy } from '@repo/bookings-payments'
import { getStripeAccountIdForRequest } from '@/lib/stripe-connect/getStripeAccountIdForRequest'
import {
  betterAuthPluginOptions,
  getExtraTrustedOriginHosts,
  getTrustedOriginsWithCustomDomains,
} from '@/lib/auth/options'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const disableSchemaPush =
  process.env.NODE_ENV === 'test' ||
  process.env.CI === 'true' ||
  // Playwright webServer sets PW_E2E_PROFILE even when NODE_ENV=development.
  // Disable schema pushing during E2E runs to avoid flaky/duplicate DDL (constraints already exist).
  Boolean(process.env.PW_E2E_PROFILE) ||
  // Disable in development to avoid Payload/Drizzle constraint name mismatches (truncation, duplicate ADD).
  // Run `payload migrate run` for schema changes. Set PAYLOAD_PUSH_SCHEMA=1 to re-enable push in dev.
  (process.env.NODE_ENV === 'development' && process.env.PAYLOAD_PUSH_SCHEMA !== '1')

export default buildConfig({
  admin: {
    components: {
      graphics: {
        Logo: '@/components/admin/AdminLogo',
        Icon: '@/components/admin/AdminIcon',
      },
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeLogin: ['@/components/BeforeLogin'],
      // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeDashboard: ['@/components/BeforeDashboard'],
      // Stripe Connect status in header so tenant-admins see it on every admin page (not only dashboard).
      header: ['@/components/admin/StripeConnectStatus'],
      // Home link at top of sidebar for quick access to dashboard (analytics).
      beforeNavLinks: ['@/components/admin/NavHomeLink'],
      // Phase 4 – Custom analytics dashboard (replaces default dashboard view).
      views: {
        dashboard: {
          Component: '@/components/admin/dashboard/AnalyticsDashboard',
        },
      },
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
      // E2E/CI runs start multiple Node processes (Next server + Playwright workers + Payload local API).
      // Increased from 2 to 5 to prevent connection pool exhaustion and deadlocks during E2E tests.
      ...(disableSchemaPush || process.env.CI || process.env.NODE_ENV === 'test'
        ? { max: 5 }
        : {}),
    },
    // Ensure CLI migrations (migrate / migrate:fresh) use our repo migrations.
    migrationDir: path.resolve(dirname, 'migrations'),
    ...(disableSchemaPush
      ? {
        push: false, // Disable automatic schema pushing in test/CI/E2E after first push
      }
      : {}),
  }),
  collections: [Pages, Posts, Media, Categories, Users, Tenants, DiscountCodes, Navbar, Footer, Scheduler],
  cors: [getServerSideURL()].filter(Boolean),
  globals: [PlatformFees],
  endpoints: [
    // Tenant-scoped Stripe customers for Connect mapping UI.
    {
      path: '/stripe/tenant-customers',
      method: 'get',
      handler: createCustomersProxy({
        scope: 'connect',
        getStripeAccountIdForRequest,
      }),
    },
  ],
  plugins,
  onInit: async (payload) => {
    // Better Auth's `trustedOrigins` is evaluated at initialization time.
    // Build it from tenant custom domains so logins from custom domains are accepted.
    try {
      const result = await payload.find({
        collection: 'tenants',
        depth: 0,
        limit: 1000,
        overrideAccess: true,
        select: { domain: true },
      })
      const tenantDomains = (result.docs as Array<{ domain?: unknown }>)
        .map((d) => (d?.domain != null ? String(d.domain).trim().toLowerCase() : ''))
        .filter(Boolean)

      const extraFromEnv = getExtraTrustedOriginHosts()
      const trustedOrigins = getTrustedOriginsWithCustomDomains([
        ...extraFromEnv,
        ...tenantDomains,
      ])

      // `payload-auth` sets `pluginOptions.betterAuthOptions` during config build.
      // Mutating it here affects the options used moments later to init Better Auth.
      ;(betterAuthPluginOptions as any).betterAuthOptions = {
        ...(betterAuthPluginOptions as any).betterAuthOptions,
        trustedOrigins,
      }
    } catch (err) {
      console.warn(
        '[auth] Failed to hydrate Better Auth trustedOrigins from tenants; falling back to static config.',
        err
      )
    }
  },
  secret: process.env.PAYLOAD_SECRET || (process.env.CI || process.env.NODE_ENV === 'test' ? 'test-secret-key-for-ci-builds-only' : 'dev-secret-key'),
  sharp: sharp as unknown as SharpDependency,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (req.user) return true

        const secret = process.env.CRON_SECRET
        if (!secret) return false

        // If there is no logged in user, then check
        // for the Vercel Cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${secret}`
      },
    },
    tasks: [
      // Override the generateLessonsFromSchedule task to include tenant context
      // This ensures the job can find tenant-scoped lessons correctly
      {
        slug: 'generateLessonsFromSchedule',
        handler: generateLessonsFromScheduleWithTenant,
      },
    ],
  },
})
