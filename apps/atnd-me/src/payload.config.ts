import { postgresAdapter } from '@payloadcms/db-postgres'
import { resendAdapter } from '@payloadcms/email-resend'
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
    // Override Payload admin head metadata (title/description/favicon) for white-labeling.
    // Note: this is static config (not request/tenant scoped).
    meta: {
      title: 'ATND ME Admin',
      description: 'ATND ME admin dashboard',
      icons: [
        {
          rel: 'icon',
          type: 'image/x-icon',
          url: '/favicon.ico',
        },
      ],
    },
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
    timezones: {
      defaultTimezone: 'Europe/Dublin',
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
  email: resendAdapter({
    defaultFromAddress: process.env.DEFAULT_FROM_ADDRESS || '',
    defaultFromName: process.env.DEFAULT_FROM_NAME || '',
    apiKey: process.env.RESEND_API_KEY || '',
  }),
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
  // Keep Payload's global CORS restrictive; we selectively allow additional origins
  // for specific public endpoints (e.g. /api/form-submissions) via Next route wrappers.
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
