import type { CollectionConfig, Config, PayloadRequest, Plugin } from 'payload'

import { isAdmin } from '@/access/userTenantAccess'

/**
 * Fix for `payload-auth/better-auth` role field schema mismatch.
 *
 * Better Auth adds a `role` field (singular), but rolesPlugin adds a `roles` field (plural).
 * This plugin ensures both fields stay in sync and that admin access checks work correctly.
 *
 * The `role` field from Better Auth is used for Better Auth's own admin checks.
 * The `roles` field from rolesPlugin is used by Payload's access control.
 * We sync them so both systems work together.
 *
 * We also restrict the `role` field to admin-only read/update (same as the roles plugin does
 * for `roles`) so tenant-admins cannot change their own or others' role to admin.
 */
export const fixBetterAuthRoleField = (): Plugin => (incomingConfig: Config): Config => {
  const config = { ...incomingConfig }

  const collections = config.collections || []
  const usersCollection = collections.find((c) => c.slug === 'users')

  if (!usersCollection) {
    return config
  }

  const fields = usersCollection.fields || []

  // Restrict the role field (Better Auth) to admin-only read/update, matching the roles field.
  const fieldsWithRoleAccess = fields.map((field) => {
    if ('name' in field && field.name === 'role') {
      const access = {
        create: ({ req }: { req: PayloadRequest }) => isAdmin(req.user),
        read: ({ req }: { req: PayloadRequest }) => isAdmin(req.user),
        update: ({ req }: { req: PayloadRequest }) => isAdmin(req.user),
      }
      return { ...field, access } as typeof field
    }
    return field
  })

  // Add hooks to sync role <-> roles
  const existingHooks = usersCollection.hooks || {}
  const existingBeforeChange = existingHooks.beforeChange || []
  const _existingAfterChange = existingHooks.afterChange || []

  const syncRoleFields = async ({
    data,
    operation: _operation,
    req: _req,
  }: {
    data?: Record<string, unknown>
    operation?: string
    req?: unknown
  }) => {
    if (!data) return data

    // Sync roles -> role (for Better Auth compatibility)
    if (data.roles && Array.isArray(data.roles) && data.roles.length > 0) {
      data.role = data.roles
    }
    // Sync role -> roles (for rolesPlugin compatibility)
    else if (data.role && Array.isArray(data.role) && data.role.length > 0) {
      data.roles = data.role
    }
    // If neither is set but we have a default, set both
    else if (!data.role && !data.roles) {
      // Let rolesPlugin's beforeChange hook handle defaults
      // We just ensure sync happens
    }

    return data
  }

  const syncRoleFieldsAfterRead = async ({ doc }: { doc?: Record<string, unknown> }) => {
    if (!doc) return doc

    // Ensure both fields are populated after read
    if (doc.roles && Array.isArray(doc.roles) && !doc.role) {
      doc.role = doc.roles
    } else if (doc.role && Array.isArray(doc.role) && !doc.roles) {
      doc.roles = doc.role
    }

    return doc
  }

  const patched: CollectionConfig = {
    ...usersCollection,
    fields: fieldsWithRoleAccess,
    hooks: {
      ...existingHooks,
      beforeChange: [syncRoleFields, ...existingBeforeChange],
      afterRead: [
        ...(existingHooks.afterRead || []),
        syncRoleFieldsAfterRead,
      ],
    },
  }

  config.collections = [
    ...collections.filter((c) => c.slug !== 'users'),
    patched,
  ]

  return config
}
