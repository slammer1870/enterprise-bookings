// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
// import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { resendAdapter } from '@payloadcms/email-resend'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { stripePlugin } from '@payloadcms/plugin-stripe'
import { mcpPlugin } from '@payloadcms/plugin-mcp'

import { migrations } from './migrations'

import path from 'path'
import { buildConfig, SharpDependency } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'

import { betterAuthPlugin } from 'payload-auth/better-auth'
import { bookingsPlugin } from '@repo/bookings-plugin'
import { paymentsPlugin } from '@repo/payments-plugin'
import {
  membershipsPlugin,
  productUpdated,
  subscriptionCanceled,
  subscriptionCreated,
  subscriptionUpdated,
} from '@repo/memberships'
import { rolesPlugin } from '@repo/roles'

import { Navbar } from './globals/navbar/config'
import { Footer } from './globals/footer/config'

import { Posts } from '@repo/website/src/collections/posts'

import {
  childrenCreateBookingMembershipAccess,
  childrenUpdateBookingMembershipAccess,
} from '@repo/shared-services'

import { isBookingAdminOrParentOrOwner } from '@repo/shared-services/src/access/bookings/is-admin-or-parent-or-owner'

import { paymentIntentSucceeded } from '@repo/payments-plugin/src/webhooks/payment-intent-suceeded'

import { setLockout } from '@repo/bookings-plugin/src/hooks/set-lockout'
import { checkRole } from '@repo/shared-utils'

import { User } from '@repo/shared-types'
import { betterAuthPluginOptions } from './lib/auth/options'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const allowedOrigins = [process.env.NEXT_PUBLIC_SERVER_URL].filter(Boolean) as string[]

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Pages, Posts],
  cors: allowedOrigins,
  csrf: allowedOrigins,
  editor: lexicalEditor(),
  email: resendAdapter({
    defaultFromAddress: 'hello@brugrappling.com',
    defaultFromName: 'Brú Grappling',
    apiKey: process.env.RESEND_API_KEY || '',
  }),
  secret: process.env.PAYLOAD_SECRET || 'sectre',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  graphQL: {
    disablePlaygroundInProduction: true,
    disable: true, // Disable GraphQL to avoid schema validation errors
  },
  db: postgresAdapter({
    pool: {
      connectionString:
        process.env.DATABASE_URI || 'postgres://postgres:brugrappling@localhost:5432/bru_grappling',
    },
    // prodMigrations: migrations,
    // push: false, // Disable automatic schema pushing - rely on migrations only
  }),
  globals: [Navbar, Footer],
  sharp: sharp as unknown as SharpDependency,
  plugins: [
    mcpPlugin({
      disabled: false,
      collections: {
        users: {
          enabled: true,
          description: 'Users are the people who use the system',
        },
        lessons: {
          enabled: true,
          description: 'Lessons are the classes that are offered',
        },
        'class-options': {
          enabled: true,
          description: 'Class options are the options for a class',
        },
        bookings: {
          enabled: true,
          description: 'Bookings are the bookings for a class',
        },
        'drop-ins': {
          enabled: true,
          description: 'Drop ins are the drop ins for a class',
        },
        subscriptions: {
          enabled: true,
          description: 'Subscriptions are the subscriptions for a user',
        },
        plans: {
          enabled: true,
          description: 'Plans are the plans for a subscription',
        },
      },
    }),
    formBuilderPlugin({
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
      },
    }),
    betterAuthPlugin(betterAuthPluginOptions as any),
    rolesPlugin({
      enabled: false,
    }),
    bookingsPlugin({
      enabled: true,
      classOptionsOverrides: {
        fields: ({ defaultFields }) => [
          ...defaultFields,
          {
            name: 'type',
            type: 'select',
            options: ['adult', 'child', 'family'],
            defaultValue: 'adult',
            required: true,
            admin: {
              description: 'Is this a class for adults or children?',
            },
          },
          {
            name: 'paymentMethods',
            type: 'group',
            fields: [
              {
                name: 'allowedPlans',
                type: 'relationship',
                relationTo: 'plans',
                hasMany: true,
                filterOptions: ({ data }) => {
                  // returns a Where query dynamically by the type of relationship
                  if (data.type === 'child') {
                    return {
                      type: { in: ['child', 'family'] },
                    }
                  } else if (data.type === 'adult') {
                    return {
                      type: { in: ['adult', 'family'] },
                    }
                  }
                  // Default case - return all plans
                  return {
                    type: { in: ['adult', 'child', 'family'] },
                  }
                },
              },
            ],
          },
        ],
      },
      bookingOverrides: {
        access: ({ defaultAccess }) => ({
          ...defaultAccess,
          read: isBookingAdminOrParentOrOwner,
          create: childrenCreateBookingMembershipAccess,
          update: childrenUpdateBookingMembershipAccess,
        }),
      },
    }),
    paymentsPlugin({
      enabled: true,
      enableDropIns: true,
      acceptedPaymentMethods: ['card'],
      paymentMethodSlugs: ['class-options'],
    }),
    membershipsPlugin({
      enabled: true,
      paymentMethodSlugs: [],
      plansOverrides: {
        fields: ({ defaultFields }) => [
          ...defaultFields,
          {
            name: 'type',
            type: 'select',
            label: 'Membership Type',
            options: [
              { label: 'Adult', value: 'adult' },
              { label: 'Child', value: 'child' },
              { label: 'Family', value: 'family' },
            ],
            defaultValue: 'adult',
            required: false,
            admin: {
              description: 'Is this a membership for adults or children?',
              position: 'sidebar',
            },
          },
          {
            name: 'quantity',
            type: 'number',
            required: false,
            defaultValue: 1,
            min: 1,
            max: 10,
            admin: {
              description: 'The number of children who are subscribing to the plan',
              condition: (data) => {
                return Boolean(data?.type === 'child') // Only show if `type` is selected
              },
              position: 'sidebar',
            },
          },
          {
            name: `classOptionsAllowedPlans`,
            label: `Class Options Allowed Plans`,
            type: 'join',
            collection: 'class-options',
            on: 'paymentMethods.allowedPlans',
            admin: {
              description: 'The classes that are available for this plan',
            },
          },
        ],
      },
    }),
    stripePlugin({
      stripeSecretKey: process.env.STRIPE_SECRET_KEY as string,
      stripeWebhooksEndpointSecret: process.env.STRIPE_WEBHOOK_SECRET,
      isTestKey: Boolean(process.env.PAYLOAD_PUBLIC_STRIPE_IS_TEST_KEY),
      rest: false,
      webhooks: {
        'payment_intent.succeeded': paymentIntentSucceeded,
        'customer.subscription.created': subscriptionCreated,
        'customer.subscription.updated': subscriptionUpdated,
        'customer.subscription.deleted': subscriptionCanceled,
        'product.updated': productUpdated,
      },
    }),
    seoPlugin({
      collections: ['pages', 'posts'],
      uploadsCollection: 'media',
      generateTitle: ({ doc }) => `${doc.title} | Brú Grappling`,
      generateDescription: ({ doc }) => doc.excerpt || doc.meta?.description,
    }),
  ],
})
