import type { CollectionConfig } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { createDefaultTenantData } from './hooks/createDefaultData'

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    useAsTitle: 'name',
    group: 'Configuration',
    defaultColumns: ['name', 'slug', 'createdAt'],
  },
  access: {
    admin: ({ req: { user } }) => {
      if (!user) return false
      // Only full admins should be able to manage tenants in the admin UI.
      return checkRole(['admin'], user as unknown as SharedUser)
    },
    read: (args) => {
      const { req: { user } } = args
      
      // Admin can read all tenants (no query filtering)
      if (user && checkRole(['admin'], user as unknown as SharedUser)) {
        return true
      }
      
      // Tenant-admins should not access/manage tenants directly (admin-only).
      if (user && checkRole(['tenant-admin'], user as unknown as SharedUser)) {
        return false
      }
      
      // Public read for listing pages (non-authenticated users)
      return true
    },
    create: (args) => {
      const { req: { user } } = args
      if (!user) return false
      return checkRole(['admin'], user as unknown as SharedUser)
    },
    update: (args) => {
      const { req: { user } } = args
      if (!user) return false
      return checkRole(['admin'], user as unknown as SharedUser)
    },
    delete: (args) => {
      const { req: { user } } = args
      if (!user) return false
      return checkRole(['admin'], user as unknown as SharedUser)
    },
  },
  hooks: {
    afterChange: [
      ({ doc, operation, req }) => {
        // Create default data when tenant is created. Defer so it runs after the
        // tenant transaction commits; inner payload.create calls use a separate
        // connection and would otherwise fail FK (tenant_id) when the tenant
        // row is not yet committed.
        if (operation === 'create') {
          // Optional: allow skipping expensive default-data creation for specific runs.
          if (process.env.PW_E2E_SKIP_DEFAULT_TENANT_DATA === 'true') return

          const tenant = doc
          const payload = req.payload
          // Use setTimeout with a small delay to ensure the tenant transaction is committed
          // before creating default data that references it via foreign keys
          setTimeout(() => {
            createDefaultTenantData({ tenant, payload, req }).catch((e) => {
              payload.logger.error(
                `Error in deferred createDefaultTenantData for tenant ${tenant.name}: ${e instanceof Error ? e.message : String(e)}`
              )
            })
          }, 100)
        }
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'domain',
      type: 'text',
      required: false,
    },
    {
      name: 'description',
      type: 'textarea',
      required: false,
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
  ],
}

