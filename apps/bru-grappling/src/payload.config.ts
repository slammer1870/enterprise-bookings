// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'

import { magicLinkPlugin } from '@repo/auth'
import { bookingsPlugin } from '@repo/bookings'
import { paymentsPlugin } from '@repo/payments'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'sectre',
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
      serverURL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
      authCollection: 'users',
    }),
    paymentsPlugin(),
    bookingsPlugin({
      enabled: true,
      paymentsEnabled: true,
      childrenEnabled: false,
    }),
  ],
  custom: {
    plugins: [
      {
        name: 'payments',
        options: {
          stripeSecretKey: process.env.STRIPE_SECRET_KEY,
          dropIns: true,
        },
      },
    ],
  },
})
