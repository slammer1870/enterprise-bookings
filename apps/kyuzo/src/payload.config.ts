// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'

import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig, Field, RelationshipField } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'

//import { migrations } from './migrations'

import { bookingsPlugin } from '@repo/bookings'
import { magicLinkPlugin } from '@repo/auth'
import { rolesPlugin } from '@repo/roles'
import { paymentsPlugin } from '@repo/payments'
import { membershipsPlugin } from '@repo/memberships'

import { Navbar } from './globals/navbar/config'
import { Footer } from './globals/footer/config'
import { Pages } from './collections/Pages'

import { Posts } from '@repo/website/src/collections/posts'

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
  globals: [Navbar, Footer],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    //prodMigrations: migrations,
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  sharp,
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
          ...defaultFields,
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
        ],
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
        ],
      },
      subscriptionOverrides: {
        fields: ({ defaultFields }) => [
          {
            name: 'user',
            type: 'relationship',
            relationTo: 'users',
            required: true,
            hasMany: true,
            admin: {
              description: 'The users who are subscribing to the plan',
            },
          },
          ...defaultFields.filter((field: any) => field.name !== 'user'),
        ],
      },
    }),
    nestedDocsPlugin({
      collections: ['users'],
      breadcrumbsFieldSlug: 'none',
    }),
    // storage-adapter-placeholder
  ],
})
