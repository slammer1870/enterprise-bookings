import type { CollectionConfig } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { createDefaultTenantData } from './hooks/createDefaultData'
import { getUserTenantIds } from '../../access/tenant-scoped'

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
      return checkRole(['admin', 'tenant-admin'], user as unknown as SharedUser)
    },
    read: (args) => {
      const { req: { user } } = args
      
      // Admin can read all tenants (no query filtering)
      if (user && checkRole(['admin'], user as unknown as SharedUser)) {
        return true
      }
      
      // Tenant-admin can only read their assigned tenants
      if (user && checkRole(['tenant-admin'], user as unknown as SharedUser)) {
        const tenantIds = getUserTenantIds(user as unknown as SharedUser)
        if (tenantIds === null || tenantIds.length === 0) return false
        
        return {
          id: {
            in: tenantIds,
          },
        }
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
      const { req: { user }, id } = args
      if (!user) return false
      
      // Admin can update any tenant
      if (checkRole(['admin'], user as unknown as SharedUser)) {
        return true
      }
      
      // Tenant-admin can only update their assigned tenants
      if (checkRole(['tenant-admin'], user as unknown as SharedUser)) {
        const tenantIds = getUserTenantIds(user as unknown as SharedUser)
        if (tenantIds === null || tenantIds.length === 0) return false
        
        // If id is provided, check if it's in the user's tenants
        if (id) {
          const tenantId = typeof id === 'object' && id !== null && 'id' in id
            ? id.id
            : id
          
          return tenantIds.includes(tenantId as number)
        }
        
        // Return query constraint to filter by tenant IDs
        return {
          id: {
            in: tenantIds,
          },
        }
      }
      
      return false
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

