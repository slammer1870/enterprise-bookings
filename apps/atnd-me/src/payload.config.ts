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
import { Navbar } from './collections/Navbar'
import { Footer } from './collections/Footer'
import { Scheduler } from './collections/Scheduler'
import { Footer as FooterGlobal } from './Footer/config'
import { Header } from './Header/config'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'
import { generateLessonsFromScheduleWithTenant } from './tasks/generate-lessons-with-tenant'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const disableSchemaPush =
  process.env.NODE_ENV === 'test' ||
  process.env.CI === 'true' ||
  // Playwright webServer sets PW_E2E_PROFILE even when NODE_ENV=development.
  // Disable schema pushing during E2E runs to avoid flaky/duplicate DDL (constraints already exist).
  Boolean(process.env.PW_E2E_PROFILE)

export default buildConfig({
  admin: {
    components: {
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeLogin: ['@/components/BeforeLogin'],
      // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeDashboard: ['@/components/BeforeDashboard'],
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
    },
    ...(disableSchemaPush
      ? {
          push: false, // Disable automatic schema pushing in test/CI/E2E after first push
        }
      : {}),
  }),
  collections: [Pages, Posts, Media, Categories, Users, Tenants, Navbar, Footer, Scheduler],
  cors: [getServerSideURL()].filter(Boolean),
  globals: [Header, FooterGlobal], // Note: Scheduler is now a collection, not a global
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
