import { checkRole } from '@repo/shared-utils/src/check-role'
import type { CollectionConfig } from 'payload'

import { User } from '@repo/shared-types'

import { adminOrUserOrInstructor } from '@repo/shared-services/src/access/is-admin-or-user-or-instructor'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    create: () => true,
    read: adminOrUserOrInstructor,
    update: ({ req: { user } }) => checkRole(['admin'], user as User),
    delete: ({ req: { user } }) => checkRole(['admin'], user as User),
    admin: ({ req: { user } }) => checkRole(['admin'], user as User),
  },
  hooks: {
    /**
     * Better Auth creates users via Payload. In this app the `role` field is required
     * (added by payload-auth/better-auth migrations) and can be omitted from the
     * sign-up payload. Ensure we always set a safe default.
     */
    beforeValidate: [
      ({ data, operation, req }) => {
        if (operation === 'create' && data) {
          // CI-only debug: understand role validation mismatch during Better Auth sign-up.
          if (process.env.CI || process.env.NODE_ENV === 'test') {
            try {
              const usersCollection: any = (req as any)?.payload?.collections?.users
              const roleField: any =
                usersCollection?.config?.fields?.find?.((f: any) => f?.name === 'role') ?? null

              // Avoid logging sensitive info; only log role-related data.
              // eslint-disable-next-line no-console
              console.log('[e2e][users.create] incoming role:', (data as any).role)
              // eslint-disable-next-line no-console
              console.log('[e2e][users.create] role options:', roleField?.options ?? null)
            } catch {
              // ignore
            }
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
  },
  // auth configuration is now handled by better-auth
  fields: [
    {
      name: 'lessons',
      type: 'join',
      collection: 'lessons',
      on: 'instructor',
      admin: {
        condition: () => false,
      },
    },
    // Email added by default
    // Add more fields as needed
    // Note: 'image' field is provided by better-auth
  ],
}
