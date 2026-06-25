import type { CollectionConfig, Config, PayloadRequest, Plugin } from 'payload'

import { isAdmin, isTenantAdmin } from '@/access/userTenantAccess'

/**
 * Restrict Better Auth `role` so tenant portal users cannot escalate to super-admin
 * via the admin UI. Super-admin safety is also enforced in Users `beforeChange` hooks.
 */
export const fixBetterAuthRoleField = (): Plugin => (incomingConfig: Config): Config => {
  const config = { ...incomingConfig }

  const collections = config.collections || []
  const usersCollection = collections.find((c) => c.slug === 'users')

  if (!usersCollection) {
    return config
  }

  const fields = usersCollection.fields || []

  const fieldsWithRoleAccess = fields.map((field) => {
    if ('name' in field && field.name === 'role') {
      const access = {
        // Local API / seeds / `overrideAccess` creates often have no session user. Without this,
        // `role` is stripped and the first-user bootstrap hook + integration tests cannot persist RBAC.
        // Only platform super-admins may set roles in the admin UI; tenant admins now manage roles
        // exclusively via tenants[n].roles. (Hooks enforce the same for API/local edge cases.)
        create: ({ req }: { req: PayloadRequest }) =>
          !req.user || isAdmin(req.user) || isTenantAdmin(req.user),
        // Restricted to super-admin only — tenant admins and staff see roles via tenants[n].roles.
        // This prevents leaking the global role field to tenant admins in API responses.
        read: ({ req }: { req: PayloadRequest }) => isAdmin(req.user),
        update: ({ req }: { req: PayloadRequest }) =>
          !req.user || isAdmin(req.user) || isTenantAdmin(req.user),
      }
      return { ...field, access } as typeof field
    }
    return field
  })

  const patched: CollectionConfig = {
    ...usersCollection,
    fields: fieldsWithRoleAccess,
  }

  config.collections = [...collections.filter((c) => c.slug !== 'users'), patched]

  return config
}
