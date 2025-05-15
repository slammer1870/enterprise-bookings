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

import { rolesPlugin } from '@repo/roles'
import { magicLinkPlugin } from '@repo/auth'
import { bookingsPlugin } from '@repo/bookings'
import { paymentsPlugin } from '@repo/payments'
import { membershipsPlugin } from '@repo/memberships'

import { subscriptionCreated } from '@repo/memberships/src/webhooks/subscription-created'
import { subscriptionUpdated } from '@repo/memberships/src/webhooks/subscription-updated'
import { subscriptionCanceled } from '@repo/memberships/src/webhooks/subscription-canceled'
import { productUpdated } from '@repo/memberships/src/webhooks/product-updated'

import { Booking, Lesson } from '@repo/shared-types'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Pages],
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
    paymentsPlugin({
      enabled: true,
      enableDropIns: false,
      acceptedPaymentMethods: ['card'],
    }),
    membershipsPlugin({
      enabled: true,
    }),
    bookingsPlugin({
      enabled: true,
      paymentMethods: {
        dropIns: false,
        plans: true,
        classPasses: false,
      },
      lessonOverrides: {
        fields: ({ defaultFields }) => [
          ...defaultFields,
          {
            name: 'originalLockOutTime',
            type: 'number',
            defaultValue: 0,
            admin: {
              hidden: true,
            },
          },
        ],
        hooks: ({ defaultHooks }) => ({
          ...(defaultHooks.afterChange || []),
          afterChange: [
            async ({ operation, doc }) => {
              if (operation === 'create') {
                doc.originalLockOutTime = doc.lockOutTime
              }
              return doc
            },
          ],
        }),
      },
      bookingOverrides: {
        hooks: ({ defaultHooks }) => ({
          ...(defaultHooks.afterChange || []),
          afterChange: [
            async ({ req, doc, context }) => {
              if (context.triggerAfterChange === false) {
                return
              }

              const lessonId = typeof doc.lesson === 'object' ? doc.lesson.id : doc.lesson

              const lessonQuery = await req.payload.find({
                collection: 'lessons',
                where: {
                  id: {
                    equals: lessonId,
                  },
                },
                depth: 2,
              })

              const lesson = lessonQuery.docs[0] as Lesson

              if (
                lesson?.bookings?.docs?.some((booking: Booking) => booking.status === 'confirmed')
              ) {
                await req.payload.update({
                  collection: 'lessons',
                  where: {
                    id: {
                      equals: lessonId,
                    },
                  },
                  data: {
                    lockOutTime: 0,
                  },
                })
              } else {
                await req.payload.update({
                  collection: 'lessons',
                  where: { id: { equals: lessonId } },
                  data: { lockOutTime: lesson.originalLockOutTime },
                })
              }

              return doc
            },
          ],
        }),
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
      collections: ['pages'],
      uploadsCollection: 'media',
      generateTitle: ({ doc }) => `The Mindful Yard — ${doc.title}`,
      generateDescription: ({ doc }) => doc.excerpt,
    }),
    // storage-adapter-placeholder
  ],
})
