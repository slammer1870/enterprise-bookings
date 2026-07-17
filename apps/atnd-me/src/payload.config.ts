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
import { Locations } from './collections/Locations'
import { PostBookingEmailDeliveries } from './collections/PostBookingEmailDeliveries'
import { PlatformFees } from './globals/PlatformFees'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'
import { generateTimeslotsFromScheduleWithTenant } from './tasks/generate-timeslots-with-tenant'
import { sendPostBookingEmailTask } from './tasks/send-post-booking-email'
import { createCustomersProxy } from '@repo/bookings-payments'
import { getStripeAccountIdForRequest } from '@/lib/stripe-connect/getStripeAccountIdForRequest'
import { resolvePayloadEmailConfig } from './utilities/emailConfig'
import { createFromFallbackEmailAdapter, resolveResendFromFallbackConfig } from './utilities/emailConfig'
import { createSubscriptionInStripeEndpoint } from './endpoints/admin/stripe/create-subscription'
import { stripeDashboardLinkEndpoint } from './endpoints/admin/stripe/dashboard-link'
import { updateStripeSubscriptionEndpoint } from './endpoints/admin/stripe/update-subscription'
import { sendLateBookingMagicLinkEndpoint } from './endpoints/admin/bookings/send-late-booking-magic-link'
import {
  getMediaUploadSizeError,
  MEDIA_MAX_FILE_SIZE_BYTES,
} from './lib/media/upload-limits'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Schema push mutates the DB from the running app; production must use migrations only.
// - production / test / CI / E2E: never push
// - development: push only when PAYLOAD_PUSH_SCHEMA=1 (opt-in); otherwise migrations + push: false
// - NODE_ENV unset (e.g. some CLI/build steps): treat like non-dev → no push
const schemaPushExplicitlyAllowedInDev =
  process.env.NODE_ENV === 'development' && process.env.PAYLOAD_PUSH_SCHEMA === '1'

// `payload migrate` runs on a clean DB (e.g. `migrate:fresh`), so it's safer to allow
// Payload's schema push for the duration of the CLI command. Some of our custom
// migrations assume base tables exist and otherwise fail with "relation does not exist".
const isPayloadMigrateCliRun = process.argv.some(
  (arg) => arg === 'migrate' || arg.startsWith('migrate:') || arg.includes('migrate:'),
)

const disableSchemaPush =
  process.env.NODE_ENV === 'production' ||
  process.env.NODE_ENV === 'test' ||
  process.env.CI === 'true' ||
  // Playwright webServer sets PW_E2E_PROFILE even when NODE_ENV=development.
  Boolean(process.env.PW_E2E_PROFILE) ||
  !schemaPushExplicitlyAllowedInDev

// Keep schema push enabled for migrations (especially `migrate:fresh`).
const disableSchemaPushDuringMigrations = disableSchemaPush && !isPayloadMigrateCliRun

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
      // AdminBranchSiteSelector is injected by the appendBranchSelectorPlugin (last in plugins array)
      // so it renders AFTER the tenant selector (which the multi-tenant plugin appends).
      beforeNavLinks: [
        '@/components/admin/NavHomeLink',
      ],
      // Reject oversized image picks/drops before multipart upload starts (avoids stuck "loading").
      providers: ['@/components/admin/MediaUploadSizeGuard'],
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
  email: (() => {
    const primaryArgs = resolvePayloadEmailConfig(process.env)
    const fallbackArgs = resolveResendFromFallbackConfig(process.env, primaryArgs)

    const primaryAdapter = resendAdapter(primaryArgs)
    const fallbackAdapter = resendAdapter(fallbackArgs)

    return createFromFallbackEmailAdapter({
      primaryAdapter,
      fallbackAdapter,
    })
  })(),
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
      // E2E/CI runs start multiple Node processes (Next server + Playwright workers + Payload local API).
      // Increased from 2 to 5 previously; some integration suites can still deadlock/time out when
      // Vitest runs many files in parallel and Payload needs DB connections during initialization.
      // Bump via PAYLOAD_DB_POOL_MAX if needed.
      ...(disableSchemaPushDuringMigrations || process.env.CI || process.env.NODE_ENV === 'test'
        ? { max: Number(process.env.PAYLOAD_DB_POOL_MAX ?? 10) }
        : {}),
    },
    // Ensure CLI migrations (migrate / migrate:fresh) use our repo migrations.
    migrationDir: path.resolve(dirname, 'migrations'),
    ...(disableSchemaPushDuringMigrations
      ? {
        push: false,
      }
      : {}),
  }),
  collections: [Pages, Posts, Media, Categories, Users, Tenants, DiscountCodes, Navbar, Footer, Scheduler, Locations, PostBookingEmailDeliveries],
  // Global multipart upload limits (busboy). Without this, fileSize defaults to Infinity.
  // abortOnLimit must be true — otherwise oversized files are truncated instead of rejected.
  // Note: Payload still drains the request body before responding, so admin UX also relies on
  // MediaUploadSizeGuard / MediaUpload client checks for immediate feedback.
  upload: {
    abortOnLimit: true,
    limits: {
      fileSize: MEDIA_MAX_FILE_SIZE_BYTES,
    },
    responseOnLimit: getMediaUploadSizeError(),
  },
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
    createSubscriptionInStripeEndpoint,
    updateStripeSubscriptionEndpoint,
    stripeDashboardLinkEndpoint,
    sendLateBookingMagicLinkEndpoint,
  ],
  plugins,
  secret: process.env.PAYLOAD_SECRET || (process.env.CI || process.env.NODE_ENV === 'test' ? 'test-secret-key-for-ci-builds-only' : 'dev-secret-key'),
  sharp: sharp as unknown as SharpDependency,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    // Keep completed scheduler jobs in production so generation failures can be inspected.
    deleteJobOnComplete: process.env.NODE_ENV === 'production' ? false : true,
    // Retry queued jobs if a worker dies mid-run (Coolify/Docker — not for serverless).
    ...(process.env.NODE_ENV === 'production'
      ? {
          autoRun: [
            {
              cron: '0 * * * * *',
              limit: 5,
              queue: 'default',
            },
          ],
        }
      : {}),
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
      // Override the generateTimeslotsFromSchedule task to include tenant context
      // This ensures the job can find tenant-scoped timeslots correctly
      {
        slug: 'generateTimeslotsFromSchedule',
        handler: generateTimeslotsFromScheduleWithTenant,
      },
      {
        slug: 'sendPostBookingEmail',
        handler: sendPostBookingEmailTask,
      },
    ],
  },
})
