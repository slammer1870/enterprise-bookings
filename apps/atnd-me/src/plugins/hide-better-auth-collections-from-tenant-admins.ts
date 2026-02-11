import type { CollectionConfig, Config, Plugin } from 'payload'

import { isAdmin } from '@/access/userTenantAccess'

const BETTER_AUTH_COLLECTION_SLUGS = ['accounts', 'sessions', 'verifications'] as const

/**
 * Restrict admin (sidebar) visibility of Better Auth collections to full admins only.
 * Tenant-admins keep access to Users but do not see Accounts, Sessions, or Verifications.
 * Admin access must return boolean (not a query constraint).
 */
const adminOnlyAccess = ({ req: { user } }: { req: { user?: unknown } }) => Boolean(user && isAdmin(user))

export const hideBetterAuthCollectionsFromTenantAdmins = (): Plugin => (incomingConfig: Config): Config => {
  const config = { ...incomingConfig }
  const collections = config.collections || []

  const patched = collections.map((coll): CollectionConfig => {
    if (!('slug' in coll) || !BETTER_AUTH_COLLECTION_SLUGS.includes(coll.slug as (typeof BETTER_AUTH_COLLECTION_SLUGS)[number])) {
      return coll
    }
    return {
      ...coll,
      access: {
        ...(typeof coll.access === 'object' && coll.access !== null ? coll.access : {}),
        admin: adminOnlyAccess,
      },
    }
  })

  config.collections = patched
  return config
}
