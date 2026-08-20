/**
 * Payload 3.84 admin nav uses `admin.hidden` + read permissions (not `access.admin`).
 * Staff-only users keep Timeslots, Users, and Emergency contacts; everything else is hidden.
 */
import type { CollectionConfig, Config, Plugin } from 'payload'

import { isStaffOnlyUser } from '@/access/userTenantAccess'
import { isPureLocationManager } from '@/access/locationManagerScope'

/** Collections staff-only users may see in the admin sidebar. */
export const STAFF_ONLY_NAV_COLLECTION_SLUGS = new Set([
  'timeslots',
  'users',
  'emergency-contacts',
])

/** Site-wide content collections that pure location managers do not need. */
export const LOCATION_MANAGER_HIDDEN_NAV_COLLECTION_SLUGS = new Set(['navbar', 'footer'])

type HiddenArgs = { user: unknown }

function composeHiddenForStaff(
  slug: string,
  previousHidden: CollectionConfig['admin'] extends { hidden?: infer H } ? H : unknown,
): (args: HiddenArgs) => boolean {
  return (args) => {
    if (isStaffOnlyUser(args.user)) {
      return !STAFF_ONLY_NAV_COLLECTION_SLUGS.has(slug)
    }
    if (isPureLocationManager(args.user)) {
      return LOCATION_MANAGER_HIDDEN_NAV_COLLECTION_SLUGS.has(slug)
    }
    if (typeof previousHidden === 'function') {
      try {
        return Boolean((previousHidden as (a: HiddenArgs) => unknown)(args))
      } catch {
        return true
      }
    }
    return Boolean(previousHidden)
  }
}

export const hideStaffNavCollections = (): Plugin => (incomingConfig: Config): Config => {
  const config = { ...incomingConfig }
  const collections = config.collections || []

  config.collections = collections.map((coll): CollectionConfig => {
    if (!('slug' in coll) || typeof coll.slug !== 'string') return coll

    const previousHidden = coll.admin?.hidden
    return {
      ...coll,
      admin: {
        ...coll.admin,
        hidden: composeHiddenForStaff(coll.slug, previousHidden),
      },
    }
  })

  return config
}
