/**
 * Payload config for the plugin dev app. Run with: pnpm dev (from package root)
 * Uses SQLite so no external DB is required. Seed creates admin user + 2 tenants for e2e.
 */
import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import sharp from 'sharp'
import { clearableTenantPlugin } from '../src/index'
import { testEmailAdapter } from './helpers/testEmailAdapter'
import { seed } from './seed'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  admin: {
    importMap: { baseDir: path.resolve(dirname) },
    user: 'users',
  },
  collections: [
    {
      slug: 'users',
      auth: true,
      fields: [
        {
          name: 'roles',
          type: 'select',
          hasMany: true,
          options: ['admin', 'tenant-admin'],
          saveToJWT: true,
        },
      ],
    },
    {
      slug: 'tenants',
      admin: { useAsTitle: 'name' },
      fields: [{ name: 'name', type: 'text', required: true }],
    },
    {
      slug: 'posts',
      fields: [{ name: 'title', type: 'text' }],
    },
  ],
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URL || 'file:./dev.db',
    },
  }),
  email: testEmailAdapter,
  onInit: async (payload) => {
    await seed(payload)
  },
  plugins: [
    multiTenantPlugin({
      tenantsSlug: 'tenants',
      collections: { posts: {} },
      // Dev/e2e: treat any logged-in user as having access to all tenants
      // so tenant list + populate-tenant-options return 2+ options immediately.
      userHasAccessToAllTenants: () => true,
    }),
    clearableTenantPlugin({
      rootDocCollections: [],
      collectionsRequireTenantOnCreate: ['posts'],
      collectionsCreateRequireTenantForTenantAdmin: [],
      // Dev/e2e: seed user has roles: ['admin']. Override so any logged-in user gets all tenants (covers other test users).
      userHasAccessToAllTenants: () => true,
    }),
  ],
  secret: process.env.PAYLOAD_SECRET || 'dev-secret',
  sharp,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
})
