// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'

import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'

import { bookingsPlugin } from '@repo/bookings/src'
import { magicLinkPlugin } from '@repo/auth/src'
import { rolesPlugin } from '@repo/roles/src'
import { paymentsPlugin } from '@repo/payments/src'

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
          rel: 'icon',
          type: 'image/png',
          url: '/logos/mindful.png',
        },
      ],
    },
  },
  collections: [Users, Media, Pages],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'sectre',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI,
    },
  }),
  sharp,
  plugins: [
    payloadCloudPlugin(),
    vercelBlobStorage({
      enabled: true,
      collections: {
        media: true,
      },
      token: process.env.BLOB_READ_WRITE_TOKEN,
    }),
    magicLinkPlugin({
      enabled: true,
      serverURL: process.env.NEXT_PUBLIC_SERVER_URL,
    }),
    rolesPlugin({
      enabled: true,
    }),
    paymentsPlugin({
      enabled: true,
      enableDropIns: true,
      acceptedPaymentMethods: ['cash'],
    }),
    bookingsPlugin({
      enabled: true,
      paymentsMethods: {
        dropIns: true,
        plans: false,
        classePasses: false,
      },
    }),
    // storage-adapter-placeholder
  ],
})
