// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { stripePlugin } from '@payloadcms/plugin-stripe'
import { resendAdapter } from '@payloadcms/email-resend'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { seoPlugin } from '@payloadcms/plugin-seo'

import path from 'path'
import { buildConfig, SharpDependency } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'

import { Posts } from '@repo/website/src/collections/posts'

import { rolesPlugin } from '@repo/roles'
import { magicLinkPlugin } from '@repo/auth/server'
import { bookingsPlugin } from '@repo/bookings'
import { paymentsPlugin } from '@repo/payments'
import { membershipsPlugin } from '@repo/memberships'

import { subscriptionCreated } from '@repo/memberships/src/webhooks/subscription-created'
import { subscriptionUpdated } from '@repo/memberships/src/webhooks/subscription-updated'
import { subscriptionCanceled } from '@repo/memberships/src/webhooks/subscription-canceled'
import { productUpdated } from '@repo/memberships/src/webhooks/product-updated'

import { Lesson, User } from '@repo/shared-types'

import {
  bookingCreateMembershipDropinAccess,
  bookingUpdateMembershipDropinAccess,
} from '@repo/shared-services/src/access/booking-membership-dropin'

import { isAdminOrOwner } from '@repo/bookings/src/access/bookings'

import { checkRole } from '@repo/shared-utils'
import { getLastCheckIn } from './hooks/get-last-checkin'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    timezones: {
      defaultTimezone: 'Europe/Dublin',
    },
  },
  collections: [Users, Media, Pages, Posts],
  editor: lexicalEditor(),
  email: resendAdapter({
    defaultFromAddress: process.env.DEFAULT_FROM_ADDRESS || '',
    defaultFromName: process.env.DEFAULT_FROM_NAME || '',
    apiKey: process.env.RESEND_API_KEY || '',
  }),
  secret: process.env.PAYLOAD_SECRET || 'secret',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString:
        process.env.DATABASE_URI ||
        'postgres://postgres:brugrappling@localhost:5432/darkhorse_strength',
    },
  }),
  sharp: sharp as unknown as SharpDependency,
  plugins: [
    payloadCloudPlugin(),
    magicLinkPlugin({
      enabled: true,
      appName: 'Darkhorse Strength',
      serverURL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
      authCollection: 'users',
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

              const confirmed = doc.status === 'confirmed'

              Promise.resolve().then(async () => {
                if (confirmed) {
                  await req.payload.update({
                    collection: 'lessons',
                    id: lessonId,
                    data: {
                      lockOutTime: 0,
                    },
                  })
                  return doc
                }

                const lesson = (await req.payload.findByID({
                  collection: 'lessons',
                  id: lessonId,
                  depth: 2,
                })) as Lesson

                if (
                  !lesson.bookings?.docs
                    ?.filter((booking) => booking.id != doc.id)
                    .some((booking) => booking.status === 'confirmed')
                ) {
                  await req.payload.update({
                    collection: 'lessons',
                    id: lessonId,
                    data: {
                      lockOutTime: lesson.originalLockOutTime,
                    },
                  })
                  return doc
                }

                return doc
              })
            },
          ],
        }),
        access: ({ defaultAccess }) => ({
          ...defaultAccess,
          create: bookingCreateMembershipDropinAccess,
          update: bookingUpdateMembershipDropinAccess,
        }),
      },
    }),
    paymentsPlugin({
      enabled: true,
      enableDropIns: false,
      acceptedPaymentMethods: ['card'],
    }),
    membershipsPlugin({
      enabled: true,
      paymentMethodSlugs: ['class-options'],
      subscriptionOverrides: {
        fields: ({ defaultFields }) => [
          ...defaultFields,
          {
            name: 'lastCheckIn',
            type: 'date',
            virtual: true,
            readOnly: true,
            admin: {
              hidden: true,
              readOnly: true,
              components: {
                Cell: '@/fields/last-check-in',
              },
            },
            hooks: {
              afterRead: [getLastCheckIn],
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
        'customer.subscription.created': subscriptionCreated,
        'customer.subscription.updated': subscriptionUpdated,
        'customer.subscription.deleted': subscriptionCanceled,
        'product.updated': productUpdated,
      },
    }),
    formBuilderPlugin({}),
    seoPlugin({
      collections: ['pages', 'posts'],
      uploadsCollection: 'media',
      generateTitle: ({ doc }) => `Darkhorse Strength — ${doc.title}`,
      generateDescription: ({ doc }) => doc.excerpt,
    }),
    // storage-adapter-placeholder
  ],
})
