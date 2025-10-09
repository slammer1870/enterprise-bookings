// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { stripePlugin } from '@payloadcms/plugin-stripe'
import { resendAdapter } from '@payloadcms/email-resend'

import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig, SharpDependency } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'

import { bookingsPlugin } from '@repo/bookings'
import { magicLinkPlugin } from '@repo/auth/server'
import { rolesPlugin } from '@repo/roles'
import { paymentsPlugin } from '@repo/payments'
import { membershipsPlugin } from '@repo/memberships'

import { subscriptionCreated } from '@repo/memberships/src/webhooks/subscription-created'
import { subscriptionUpdated } from '@repo/memberships/src/webhooks/subscription-updated'
import { subscriptionCanceled } from '@repo/memberships/src/webhooks/subscription-canceled'
import { productUpdated } from '@repo/memberships/src/webhooks/product-updated'

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
    magicLinkPlugin({
      enabled: true,
      appName: 'Kyuzo',
      serverURL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
      authCollection: 'users',
    }),
    rolesPlugin({
      enabled: true,
    }),
    bookingsPlugin({
      enabled: true,
      classOptionsOverrides: {
        fields: ({ defaultFields }) => [
          ...defaultFields.filter((field: any) => field.name !== 'paymentMethods'),
          {
            name: 'type',
            type: 'select',
            options: ['adult', 'child'],
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
                    type: { in: ['adult', 'child'] },
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
      enableDropIns: false,
      acceptedPaymentMethods: ['card'],
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
        'customer.subscription.created': subscriptionCreated,
        'customer.subscription.updated': subscriptionUpdated,
        'customer.subscription.deleted': subscriptionCanceled,
        'product.updated': productUpdated,
      },
    }),
    seoPlugin({
      collections: ['pages', 'posts'],
      uploadsCollection: 'media',
      generateTitle: ({ doc }) => `Kyuzo Jiu Jitsu — ${doc.title}`,
      generateDescription: ({ doc }) => doc.excerpt,
    }),
    masqueradePlugin({
      enabled: false,
    }),
    // storage-adapter-placeholder
  ],
})
