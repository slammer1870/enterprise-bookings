import type { CollectionConfig, Config, Plugin } from 'payload'

import { isAdmin } from '@/access/userTenantAccess'

const WEBSITE_ADMIN_ONLY_COLLECTION_SLUGS = [
  'categories',
  'redirects',
  'search',
] as const

const adminOnlyAccess = ({ req: { user } }: { req: { user?: unknown } }): boolean =>
  Boolean(user && isAdmin(user))

export const hideWebsiteCollectionsFromTenantAdmins = (): Plugin => (
  incomingConfig: Config,
): Config => {
  const config = { ...incomingConfig }
  const collections = config.collections || []

  config.collections = collections.map((coll): CollectionConfig => {
    if (
      !('slug' in coll) ||
      !WEBSITE_ADMIN_ONLY_COLLECTION_SLUGS.includes(
        coll.slug as (typeof WEBSITE_ADMIN_ONLY_COLLECTION_SLUGS)[number],
      )
    ) {
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

  return config
}
