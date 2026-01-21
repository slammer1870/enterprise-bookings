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
    read: (args) => {
      // Admin can read all tenants (no query filtering)
      const { req: { user } } = args
      if (user && checkRole(['admin'], user as unknown as SharedUser)) {
        return true
      }
      // Public read for listing pages
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
          const tenant = doc
          const payload = req.payload
          setImmediate(() => {
            createDefaultTenantData({ tenant, payload, req }).catch((e) => {
              payload.logger.error(
                `Error in deferred createDefaultTenantData for tenant ${tenant.name}: ${e instanceof Error ? e.message : String(e)}`
              )
            })
          })
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

