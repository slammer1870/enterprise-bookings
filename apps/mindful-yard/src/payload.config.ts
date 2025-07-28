// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig, SharpDependency } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'

import { bookingsPlugin } from '@repo/bookings'
import { magicLinkPlugin } from '@repo/auth/server'
import { rolesPlugin } from '@repo/roles'
import { paymentsPlugin } from '@repo/payments'

import { seoPlugin } from '@payloadcms/plugin-seo'

import { resendAdapter } from '@payloadcms/email-resend'

import { Transaction, User } from '@repo/shared-types'

import {
  bookingCreateDropinAccess,
  bookingUpdateDropinAccess,
} from '@repo/shared-services/src/access/booking-dropin'
import { checkRole } from '@repo/shared-utils'
import { isAdminOrOwner } from '@repo/bookings/src/access/bookings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      icons: [
        {
          type: 'image/png',
          rel: 'icon',
          url: '/assets/favicon.ico',
        },
      ],
    },
    timezones: {
      defaultTimezone: 'Europe/Dublin',
    },
  },
  collections: [Users, Media, Pages],
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
        process.env.DATABASE_URI || 'postgres://postgres:brugrappling@localhost:5432/mindful_yard',
    },
  }),
  sharp: sharp as unknown as SharpDependency,
  plugins: [
    payloadCloudPlugin(),
    rolesPlugin({
      enabled: true,
    }),
    magicLinkPlugin({
      enabled: true,
      serverURL: process.env.NEXT_PUBLIC_SERVER_URL,
      appName: 'The Mindful Yard',
    }),
    bookingsPlugin({
      enabled: true,
      bookingOverrides: {
        fields: ({ defaultFields }) => [
          ...defaultFields,
          {
            name: 'transaction',
            label: 'Transaction',
            type: 'relationship',
            relationTo: 'transactions',
            admin: {
              position: 'sidebar',
              description: 'Associated transaction for this booking',
            },
          },
        ],
        hooks: ({ defaultHooks }) => ({
          ...defaultHooks,
          afterChange: [
            ...(defaultHooks.afterChange || []),
            async ({ req, operation, doc }) => {
              if (operation === 'update' && doc.status === 'cancelled') {
                // Don't block the response by running this asynchronously
                Promise.resolve().then(async () => {
                  try {
                    if (!doc.transaction || !req.user) return

                    const transaction = (await req.payload.findByID({
                      collection: 'transactions',
                      id: doc.transaction,
                      depth: 3,
                    })) as Transaction

                    if (transaction.createdBy?.id !== req.user.id) {
                      return
                    }

                    await req.payload.update({
                      collection: 'bookings',
                      where: {
                        and: [
                          {
                            transaction: {
                              equals: transaction.id,
                            },
                          },
                          {
                            status: {
                              not_equals: 'cancelled',
                            },
                          },
                        ],
                      },
                      data: {
                        status: 'cancelled',
                      },
                    })
                  } catch (error) {
                    console.error('Error in bookings afterChange background task:', error)
                  }
                })
              }

              return doc
            },
          ],
        }),
        access: {
          read: isAdminOrOwner,
          create: bookingCreateDropinAccess,
          update: bookingUpdateDropinAccess,
          delete: ({ req }) => checkRole(['admin'], req.user as User),
        },
      },
    }),
    paymentsPlugin({
      enabled: true,
      enableDropIns: true,
      acceptedPaymentMethods: ['cash'],
      paymentMethodSlugs: ['class-options'],
    }),
    seoPlugin({
      collections: ['pages'],
      uploadsCollection: 'media',
      generateTitle: ({ doc }) => `The Mindful Yard — ${doc.title}`,
      generateDescription: ({ doc }) => doc.excerpt,
    }),
  ],
})
