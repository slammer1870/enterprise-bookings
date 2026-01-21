import type { CollectionConfig, User } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'

import { authenticated } from '../../access/authenticated'

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
    },
    // Note: 'tenants' field is automatically added by @payloadcms/plugin-multi-tenant
    // This field tracks which tenants the user has access to (for tenant-admins or cross-tenant users)
  ],
  timestamps: true,
}
