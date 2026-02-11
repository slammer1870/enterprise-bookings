import type { CollectionConfig, Config, Plugin } from 'payload'

import { isAdmin } from '@/access/userTenantAccess'

const BETTER_AUTH_COLLECTION_SLUGS = ['accounts', 'sessions', 'verifications', 'admin-invitations'] as const

/** Only full admins. Returns boolean only (required by collection access.admin and others). */
const adminOnlyAccess = ({ req: { user } }: { req: { user?: unknown } }): boolean =>
  Boolean(user && isAdmin(user))

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
        read: adminOnlyAccess,
        create: adminOnlyAccess,
        update: adminOnlyAccess,
        delete: adminOnlyAccess,
      },
    }
  })

  config.collections = patched
  return config
}
