// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { stripePlugin } from '@payloadcms/plugin-stripe'

import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig, Config, SharpDependency } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'

import { bookingsPlugin } from '@repo/bookings'
import { magicLinkPlugin } from '@repo/auth/server'
import { rolesPlugin } from '@repo/roles'
import { paymentsPlugin } from '@repo/payments'
import {
  membershipsPlugin,
  subscriptionCreated,
  subscriptionUpdated,
  subscriptionCanceled,
  productUpdated,
} from '@repo/memberships'

import { Navbar } from './globals/navbar/config'
import { Footer } from './globals/footer/config'
import { Pages } from './collections/Pages'

import {
  childrenCreateBookingMembershipAccess,
  childrenUpdateBookingMembershipAccess,
} from '@repo/shared-services'

import { Posts } from '@repo/website'

import { seed } from './endpoints/seed'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const config: Config = {
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
  endpoints: [
    {
      path: '/seed',
      method: 'post',
      handler: seed,
    },
  ],
  secret: process.env.PAYLOAD_SECRET || 'secret',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString:
        process.env.DATABASE_URI || 'postgres://postgres:brugrappling@localhost:5432/kyuzo_e2e',
    },
  }),
  sharp: sharp as SharpDependency,
  plugins: [
    payloadCloudPlugin(),
    formBuilderPlugin({
      fields: {
        // Customize form fields if needed
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
                      or: [
                        {
                          type: { equals: 'child' },
                        },
                        {
                          type: { equals: 'family' },
                        },
                      ],
                    }
                  } else if (data.type === 'adult') {
                    return {
                      or: [
                        {
                          type: { equals: 'adult' },
                        },
                        {
                          type: { equals: 'family' },
                        },
                      ],
                    }
                  }
                  // Default case - return all plans
                  return {
                    or: [
                      {
                        type: { equals: 'adult' },
                      },
                      {
                        type: { equals: 'family' },
                      },
                      {
                        type: { equals: 'child' },
                      },
                    ],
                  }
                },
              },
            ],
          },
        ],
      },
      bookingOverrides: {
        access: {
          create: childrenCreateBookingMembershipAccess,
          update: childrenUpdateBookingMembershipAccess,
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
      paymentMethodSlugs: [],
      plansOverrides: {
        fields: ({ defaultFields }) => [
          ...defaultFields,
          {
            name: 'type',
            type: 'select',
            options: ['adult', 'family', 'child'],
            defaultValue: 'adult',
            required: true,
            admin: {
              description: 'Is this a membership for adults, family or children?',
            },
          },
          {
            name: 'quantity',
            type: 'number',
            required: false,
            admin: {
              description: 'The number of children who are subscribing to the plan',
              condition: (data) => {
                return Boolean(data?.type === 'child') // Only show if `type` is selected
              },
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
    // storage-adapter-placeholder
  ],
}

export default buildConfig(config)
