import { checkRole } from '@repo/shared-utils'
import type { CollectionConfig } from 'payload'

import { User } from '@repo/shared-types'

import { adminOrUserOrParentOrInstructor } from '@repo/shared-services/src/access/is-admin-or-user-or-parent-or-instructor'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'createdAt'],
  },
  access: {
    create: () => true,
    read: adminOrUserOrParentOrInstructor,
    update: ({ req: { user } }) => checkRole(['admin'], user as User),
    delete: ({ req: { user } }) => checkRole(['admin'], user as User),
    admin: ({ req: { user } }) => checkRole(['admin'], user as User),
  },
  hooks: {
    /**
     * Better Auth creates users via Payload. The `role` field is required
     * (added by payload-auth/better-auth migrations) and can be omitted from the
     * sign-up payload. Ensure we always set a safe default.
     *
     * Use beforeChange (runs before beforeValidate) to ensure name and role fields
     * are set before validation occurs.
     */
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create' && data) {
          // Ensure name field has a value (better-auth requires it but may not provide it during first user registration)
          const nameValue = (data as any).name
          if (
            !nameValue ||
            (typeof nameValue === 'string' && nameValue.trim() === '') ||
            nameValue === null ||
            nameValue === undefined
          ) {
            const email = (data as any).email || 'User'
            ;(data as any).name =
              typeof email === 'string' ? email.split('@')[0] || 'User' : 'User'
          }

          // Keep in sync with `betterAuthPluginOptions.users.defaultRole`
          if (!('role' in data) || (data as any).role == null) {
            ;(data as any).role = 'user'
          }
          // rolesPlugin adds `roles` (hasMany). Keep a consistent default.
          if (!('roles' in data) || (data as any).roles == null) {
            ;(data as any).roles = ['user']
          }
        }
        return data
      },
    ],
    beforeValidate: [
      ({ data, operation }) => {
        if (operation === 'create' && data) {
          // Double-check name field in beforeValidate (defensive)
          if (
            !('name' in data) ||
            !(data as any).name ||
            String((data as any).name || '').trim() === ''
          ) {
            const email = (data as any).email || 'User'
            ;(data as any).name = email.split('@')[0] || 'User'
          }
        }
        return data
      },
    ],
  },
  fields: [
    // Note: 'image' field is provided by better-auth
    {
      name: 'lessons',
      type: 'join',
      collection: 'lessons',
      on: 'instructor',
      admin: {
        condition: () => false,
      },
    },
    {
      // NOTE: avoid naming collisions with db adapters / internal "parent" semantics
      // (we've seen flaky auth-session writes in CI with a self-referencing relationship named "parent")
      name: 'parentUser',
      type: 'relationship',
      relationTo: 'users',
      hasMany: false,
      admin: {
        position: 'sidebar',
        description: 'Parent of the user',
        condition: ({ children }) => {
          if (children && children.docs.length > 0) {
            return false
          }
          return true
        },
      },
    },
    {
      name: 'children',
      type: 'join',
      collection: 'users',
      on: 'parentUser',
      admin: {
        condition: ({ children }) => {
          if (children && children.docs.length > 0) {
            return true
          }
          return false
        },
      },
    },
    // Email added by default
    // Add more fields as needed
  ],
}
