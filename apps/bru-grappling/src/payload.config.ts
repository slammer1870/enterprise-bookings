// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
// import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { resendAdapter } from '@payloadcms/email-resend'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { stripePlugin } from '@payloadcms/plugin-stripe'

import path from 'path'
import { buildConfig, SharpDependency } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'

import { magicLinkPlugin } from '@repo/auth/server'
import { bookingsPlugin } from '@repo/bookings'
import { paymentsPlugin } from '@repo/payments'
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

import { paymentIntentSucceeded } from '@repo/payments/src/webhooks/payment-intent-suceeded'

import { setLockout } from '@repo/bookings/src/hooks/set-lockout'
import { checkRole } from '@repo/shared-utils'

import { User } from '@repo/shared-types'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Pages, Posts],
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
  db: postgresAdapter({
    pool: {
      connectionString:
        process.env.DATABASE_URI || 'postgres://postgres:brugrappling@localhost:5432/bru_grappling',
    },
  }),
  globals: [Navbar, Footer],
  sharp: sharp as unknown as SharpDependency,
  plugins: [
    //payloadCloudPlugin(),
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
    magicLinkPlugin({
      enabled: true,
      serverURL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
      authCollection: 'users',
      appName: 'Brú Grappling',
    }),
    rolesPlugin({
      enabled: true,
    }),
    bookingsPlugin({
      enabled: true,
      lessonOverrides: {
        fields: ({ defaultFields }) => [
          ...defaultFields,
          {
            name: 'originalLockOutTime',
            type: 'number',
            admin: {
              hidden: true,
            },
          },
        ],
        hooks: ({ defaultHooks }) => ({
          ...defaultHooks,
          beforeOperation: [
            ...(defaultHooks.beforeOperation || []),
            async ({ args, operation }) => {
              if (operation === 'create') {
                args.data.originalLockOutTime = args.data.lockOutTime
              }

              return args
            },
          ],
        }),
      },
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
              {
                name: 'allowedDropIn',
                label: 'Allowed Drop In',
                type: 'relationship',
                relationTo: 'drop-ins',
                hasMany: false,
              },
            ],
          },
        ],
      },
      bookingOverrides: {
        hooks: ({ defaultHooks }) => ({
          ...defaultHooks,
          afterChange: [...(defaultHooks.afterChange || []), setLockout],
        }),
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
      paymentMethodSlugs: [],
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
      generateTitle: ({ doc }) => `Brú Grappling — ${doc.title}`,
      generateDescription: ({ doc }) => doc.excerpt,
    }),
  ],
})
