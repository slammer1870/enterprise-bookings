import type { Config, Plugin } from 'payload'

import { syncPublicMediaFlags } from '@/utilities/syncPublicMedia'

/**
 * Collections that can affect which media must be public for Next/Image without
 * tenant cookies. User images are only public when the user is staff on an active
 * timeslot — so timeslot changes must re-sync as well.
 */
const PUBLIC_MEDIA_COLLECTIONS = new Set(['users', 'courses', 'timeslots'])

/**
 * Course covers and timeslot-host user images appear on public pages. Next/Image
 * often fetches `/api/media/file/...` without tenant cookies, so those media docs
 * must be marked `isPublic` when the parent doc is saved (same as pages/navbar/footer).
 */
export const syncStaffPublicMediaPlugin =
  (): Plugin =>
  (config: Config): Config => ({
    ...config,
    collections: (config.collections ?? []).map((collection) => {
      if (!PUBLIC_MEDIA_COLLECTIONS.has(collection.slug)) return collection
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
