// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { stripePlugin } from '@payloadcms/plugin-stripe'
import { resendAdapter } from '@payloadcms/email-resend'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { seoPlugin } from '@payloadcms/plugin-seo'

import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'

import { Posts } from '@repo/website/src/collections/posts'

import { rolesPlugin } from '@repo/roles'
import { magicLinkPlugin } from '@repo/auth'
import { bookingsPlugin } from '@repo/bookings'
import { paymentsPlugin } from '@repo/payments'
import { membershipsPlugin } from '@repo/memberships'

import { subscriptionCreated } from '@repo/memberships/src/webhooks/subscription-created'
import { subscriptionUpdated } from '@repo/memberships/src/webhooks/subscription-updated'
import { subscriptionCanceled } from '@repo/memberships/src/webhooks/subscription-canceled'
import { productUpdated } from '@repo/memberships/src/webhooks/product-updated'

import { Booking, Lesson, User } from '@repo/shared-types'

import {
  bookingCreateMembershipDropinAccess,
  bookingUpdateMembershipDropinAccess,
} from '@repo/shared-services/src/access/booking-membership-dropin'

import { isAdminOrOwner } from '@repo/bookings/src/access/bookings'

import { checkRole } from '@repo/shared-utils'

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
  secret: process.env.PAYLOAD_SECRET || 'secret',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString:
        process.env.DATABASE_URI || 'postgres://postgres:brugrappling@localhost:5432/bookings',
    },
  }),
  sharp,
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
          ...(defaultHooks.beforeOperation || []),
          beforeOperation: [
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
              console.log('Booking afterChange hook called with:', {
                docId: doc.id,
                lesson: doc.lesson,
                lessonType: typeof doc.lesson,
                context,
              })

              if (context.triggerAfterChange === false) {
                console.log('Skipping hook due to triggerAfterChange flag')
                return
              }

              try {
                // Handle different possible formats of lesson ID
                let lessonId: number

                if (typeof doc.lesson === 'string') {
                  // If it's a string, try to parse it as JSON first
                  try {
                    const parsed = JSON.parse(doc.lesson)
                    lessonId = Number(parsed.id)
                  } catch {
                    // If not JSON, try to parse as number directly
                    lessonId = Number(doc.lesson)
                  }
                } else if (typeof doc.lesson === 'object' && doc.lesson !== null) {
                  // If it's an object, get the ID
                  lessonId = Number(doc.lesson.id)
                } else {
                  return doc
                }

                if (isNaN(lessonId)) {
                  return doc
                }

                const lessonQuery = await req.payload.findByID({
                  collection: 'lessons',
                  id: lessonId,
                  depth: 2,
                })

                const lesson = lessonQuery as Lesson
                console.log('Found lesson:', {
                  id: lesson.id,
                  hasConfirmedBookings: lesson?.bookings?.docs?.some(
                    (booking: Booking) => booking.status === 'confirmed',
                  ),
                })

                if (
                  lesson?.bookings?.docs?.some((booking: Booking) => booking.status === 'confirmed')
                ) {
                  console.log('Setting lockOutTime to 0')
                  await req.payload.update({
                    collection: 'lessons',
                    id: lessonId,
                    data: {
                      lockOutTime: 0,
                    },
                  })
                } else {
                  console.log('Restoring original lockOutTime:', lesson.originalLockOutTime)
                  await req.payload.update({
                    collection: 'lessons',
                    id: lessonId,
                    data: { lockOutTime: lesson.originalLockOutTime },
                  })
                }
              } catch (error) {
                console.error('Error in booking afterChange hook:', error)
              }

              return doc
            },
          ],
        }),
        access: {
          read: isAdminOrOwner,
          create: bookingCreateMembershipDropinAccess,
          update: bookingUpdateMembershipDropinAccess,
          delete: ({ req }) => checkRole(['admin'], req.user as User),
        },
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
