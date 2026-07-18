import type { Config, Plugin } from 'payload'

import { syncPublicMediaFlags } from '@/utilities/syncPublicMedia'

/**
 * Staff profile images appear on the public schedule. Next/Image often fetches
 * `/api/media/file/...` without tenant cookies, so those media docs must be
 * marked `isPublic` when staff are saved (same as pages/navbar/footer).
 */
export const syncStaffPublicMediaPlugin =
  (): Plugin =>
  (config: Config): Config => ({
    ...config,
    collections: (config.collections ?? []).map((collection) => {
      if (collection.slug !== 'staff-members') return collection
      const hooks = collection.hooks ?? {}
      return {
        ...collection,
        hooks: {
          ...hooks,
          afterChange: [...(hooks.afterChange ?? []), async ({ req }) => syncPublicMediaFlags(req)],
          afterDelete: [...(hooks.afterDelete ?? []), async ({ req }) => syncPublicMediaFlags(req)],
        },
      }
    }),
  })
