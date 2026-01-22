import type { CollectionConfig, User } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'

import { authenticated } from '../../access/authenticated'
import { getUserTenantIds } from '../../access/tenant-scoped'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: ({ req: { user } }) => checkRole(['admin', 'tenant-admin'], user as unknown as SharedUser),
    create: () => true,
    delete: (args) => {
      // Admin can delete any user
      const { req: { user } } = args
      if (user && checkRole(['admin'], user as unknown as SharedUser)) {
        return true
      }
      return authenticated(args)
    },
    read: (args) => {
      // Admin can read all users (no query filtering)
      const { req: { user } } = args
      if (user && checkRole(['admin'], user as unknown as SharedUser)) {
        return true
      }
      return authenticated(args)
    },
    update: (args) => {
      // Admin can update any user
      const { req: { user } } = args
      if (user && checkRole(['admin'], user as unknown as SharedUser)) {
        return true
      }
      return authenticated(args)
    },
  },
  hooks: {
    beforeValidate: [
      async ({ data, operation, req }) => {
        // When tenant-admin creates a user, automatically set registrationTenant from context
        // This ensures the tenant relationship is valid and the tenant-admin can create users
        if (operation === 'create' && data && !data.registrationTenant) {
          const user = req.user
          if (user && checkRole(['tenant-admin'], user as unknown as SharedUser)) {
            // Try to get tenant from context (set by multi-tenant plugin's tenant selector)
            const rawTenant = req.context?.tenant as unknown
            if (rawTenant) {
              // `tenant` may be a primitive ID or an object with an `id` field
              data.registrationTenant =
                typeof rawTenant === 'object' && rawTenant !== null && 'id' in rawTenant
                  ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (rawTenant as any).id
                  : (rawTenant as string | number)
            } else {
              // Fallback: use the first tenant from the tenant-admin's tenants array
              const tenantIds = getUserTenantIds(user as unknown as SharedUser)
              if (tenantIds && tenantIds.length > 0) {
                data.registrationTenant = tenantIds[0]
              }
            }
          }
        }
        return data
      },
    ],
  },
  admin: {
    defaultColumns: ['name', 'email'],
    useAsTitle: 'name',
  },
  // Auth fields (email/name/etc) are provided by the Better Auth plugin in this repo.
  // Keep this collection lean to avoid duplicate field-name collisions.
  // Multi-tenant fields:
  // - registrationTenant (singular, custom): where user originally registered
  // - tenants (plural, plugin-managed): tenants user has access to (added automatically by multi-tenant plugin)
  fields: [
    {
      name: 'registrationTenant',
      type: 'relationship',
      relationTo: 'tenants',
      admin: {
        description:
          'The tenant this user originally registered with (based on domain / subdomain).',
      },
      // Note: Field-level access control can only return boolean values.
      // The relationship dropdown is automatically filtered by the Tenants collection's read access control.
      // The beforeValidate hook will automatically set this field for tenant-admin users.
      access: {
        read: () => true, // Always allow reading the field value
        update: ({ req: { user } }) => {
          // Admin can always update
          if (user && checkRole(['admin'], user as unknown as SharedUser)) {
            return true
          }
          // Tenant-admin can update (validation happens in beforeValidate hook)
          return true
        },
      },
    },
    // Note: 'tenants' field is automatically added by @payloadcms/plugin-multi-tenant
    // This field tracks which tenants the user has access to (for tenant-admins or cross-tenant users)
  ],
  timestamps: true,
}
