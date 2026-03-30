// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { stripePlugin } from '@payloadcms/plugin-stripe'
import { resendAdapter } from '@payloadcms/email-resend'

import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig, type CollectionSlug, SharpDependency } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { migrations } from './migrations'

import { bookingsPlugin } from '@repo/bookings-plugin'
import { betterAuthPlugin } from 'payload-auth/better-auth'
import { betterAuthPluginOptions } from './lib/auth/options'
import { fixBetterAuthRoleField } from './plugins/fix-better-auth-role-field'
import { fixBetterAuthTimestamps } from '@repo/better-auth-config/fix-better-auth-timestamps'
import { rolesPlugin } from '@repo/roles'
import {
  bookingsPaymentsPlugin,
  subscriptionCreated,
  subscriptionUpdated,
  subscriptionCanceled,
  productUpdated,
} from '@repo/bookings-payments'

import { Navbar } from './globals/navbar/config'
import { Footer } from './globals/footer/config'
import { Pages } from './collections/Pages'

import {
  childrenCreateBookingMembershipAccess,
  childrenUpdateBookingMembershipAccess,
} from '@repo/shared-services/src/access/children-booking-membership'

import { Posts } from '@repo/website/src/collections/posts'
import { isBookingAdminOrParentOrOwner } from '@repo/shared-services/src/access/bookings/is-admin-or-parent-or-owner'

import { newsletter } from './hook/newsletter'
import { checkRole } from '@repo/shared-utils'

import { User } from '@repo/shared-types'

import { masqueradePlugin } from 'payload-plugin-masquerade'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      graphics: {
        Logo: '/graphics/logo/index.tsx#Logo',
      },
    },
    timezones: {
      defaultTimezone: 'Europe/Dublin',
    },
  },
  collections: [Users, Media, Pages, Posts],
  globals: [Navbar, Footer],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'secret',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString:
        process.env.DATABASE_URI || 'postgres://postgres:brugrappling@localhost:5432/kyuzo',
    },
    ...(process.env.NODE_ENV === 'test' || process.env.CI || process.env.PW_E2E_PROFILE
      ? {
          migrations,
          push: false, // Disable automatic schema pushing in test/CI/E2E - rely on migrations only
        }
      : {}),
  }),
  email: resendAdapter({
    defaultFromAddress: process.env.DEFAULT_FROM_ADDRESS || '',
    defaultFromName: process.env.DEFAULT_FROM_NAME || '',
    apiKey: process.env.RESEND_API_KEY || '',
  }),
  sharp: sharp as unknown as SharpDependency,
  plugins: [
    //payloadCloudPlugin(),
    formBuilderPlugin({
      fields: {
        // Customize form fields if need
      },
      formOverrides: {
        access: {
          create: ({ req: { user } }) => checkRole(['admin'], user as User),
          update: ({ req: { user } }) => checkRole(['admin'], user as User),
          delete: ({ req: { user } }) => checkRole(['admin'], user as User),
        },
      },
      formSubmissionOverrides: {
        access: {
          read: ({ req: { user } }) => checkRole(['admin'], user as User),
          update: ({ req: { user } }) => checkRole(['admin'], user as User),
          delete: ({ req: { user } }) => checkRole(['admin'], user as User),
        },
        hooks: {
          afterChange: [newsletter],
        },
      },
    }),
    betterAuthPlugin(betterAuthPluginOptions as any),
    // Must run after betterAuthPlugin to fix timestamp validation issues
    fixBetterAuthTimestamps(),
    // Must run after betterAuthPlugin to fix role field schema for rolesPlugin
    fixBetterAuthRoleField(),
    rolesPlugin({
      enabled: true,
      roles: ['user', 'admin'],
      defaultRole: 'user',
      firstUserRole: 'admin',
    }),
    seoPlugin({
      collections: ['pages', 'posts'],
      uploadsCollection: 'media',
      generateTitle: ({ doc }) => `Kyuzo Jiu Jitsu � ${doc.title}`,
      generateDescription: ({ doc }) => doc.excerpt,
    }),
    masqueradePlugin({
      enabled: false,
    }),
    // storage-adapter-placeholder
  ],
})
