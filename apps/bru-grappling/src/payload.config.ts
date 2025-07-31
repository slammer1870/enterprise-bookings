// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
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

import { Posts } from '@repo/website/src/collections/posts'

import {
  bookingCreateMembershipDropinAccess,
  bookingUpdateMembershipDropinAccess,
} from '@repo/shared-services/src/access/booking-membership-dropin'

import { isAdminOrOwner } from '@repo/bookings/src/access/bookings'

import { Booking, Lesson, User } from '@repo/shared-types'

import { checkRole } from '@repo/shared-utils'
import {
  childrenCreateBookingMembershipAccess,
  childrenUpdateBookingMembershipAccess,
} from '@repo/shared-services/src/access/children-booking-membership'

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
    defaultFromAddress: process.env.DEFAULT_FROM_ADDRESS || '',
    defaultFromName: process.env.DEFAULT_FROM_NAME || '',
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
  globals: [Navbar],
  sharp: sharp as unknown as SharpDependency,
  plugins: [
    //payloadCloudPlugin(),
    formBuilderPlugin({}),
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
                      type: { equals: 'child' },
                    }
                  } else if (data.type === 'adult') {
                    return {
                      type: { equals: 'adult' },
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
          afterChange: [
            ...(defaultHooks.afterChange || []),
            async ({ req, doc, context }) => {
              if (context.triggerAfterChange === false) {
                return
              }

              const lessonId = typeof doc.lesson === 'object' ? doc.lesson.id : doc.lesson

              Promise.resolve().then(async () => {
                const lessonQuery = await req.payload.findByID({
                  collection: 'lessons',
                  id: lessonId,
                  depth: 2,
                })

                const lesson = lessonQuery as Lesson

                if (
                  lesson?.bookings?.docs?.some((booking: Booking) => booking.status === 'confirmed')
                ) {
                  await req.payload.update({
                    collection: 'lessons',
                    id: lessonId,
                    data: {
                      lockOutTime: 0,
                    },
                  })
                } else {
                  await req.payload.update({
                    collection: 'lessons',
                    id: lessonId,
                    data: { lockOutTime: lesson.originalLockOutTime },
                  })
                }
              })
              return doc
            },
          ],
        }),
        access: ({ defaultAccess }) => ({
          ...defaultAccess,
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
    }),
    stripePlugin({
      stripeSecretKey: process.env.STRIPE_SECRET_KEY as string,
      stripeWebhooksEndpointSecret: process.env.STRIPE_WEBHOOK_SECRET,
      isTestKey: Boolean(process.env.PAYLOAD_PUBLIC_STRIPE_IS_TEST_KEY),
      rest: false,
      webhooks: {
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
