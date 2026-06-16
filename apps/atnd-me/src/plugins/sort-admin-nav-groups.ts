import type { CollectionConfig, Config, GlobalConfig, Plugin } from 'payload'

/**
 * Payload builds admin nav groups from the order collections/globals are first
 * encountered. Ungrouped collections land in the default "Collections" group,
 * which Payload always prepends first — so we assign an explicit group and sort
 * entities so custom groups appear in the desired order.
 */
const ADMIN_NAV_GROUP_ORDER = [
  'Bookings',
  'Configuration',
  'Products',
  'Billing',
  'Website',
  'Auth',
  'Collection',
] as const

type AdminNavGroup = (typeof ADMIN_NAV_GROUP_ORDER)[number]

const HIDDEN_GROUP = '__hidden__'
const UNGROUPED_GROUP = '__ungrouped__'

const groupPriority = new Map<string, number>(
  ADMIN_NAV_GROUP_ORDER.map((group, index) => [group, index]),
)

/** Slug order within a nav group (unlisted slugs keep their relative order). */
const ADMIN_NAV_ENTITY_ORDER: Partial<Record<AdminNavGroup, readonly string[]>> = {
  Bookings: ['timeslots'],
}

function resolveGroup(
  entity: CollectionConfig | GlobalConfig,
  defaultUngroupedGroup: AdminNavGroup,
): string {
  const group = entity.admin?.group

  if (group === false) {
    return HIDDEN_GROUP
  }

  if (group == null || group === '') {
    return UNGROUPED_GROUP
  }

  if (typeof group === 'string') {
    return group
  }

  return String(group)
}

function getWithinGroupPriority(
  entity: CollectionConfig | GlobalConfig,
  group: string,
  defaultUngroupedGroup: AdminNavGroup,
): number {
  const order = ADMIN_NAV_ENTITY_ORDER[group as AdminNavGroup]
  if (!order) {
    return Number.POSITIVE_INFINITY
  }

  const slug = entity.slug
  const index = order.indexOf(slug)
  return index === -1 ? Number.POSITIVE_INFINITY : index
}

function withExplicitCollectionGroup(
  collection: CollectionConfig,
  defaultUngroupedGroup: AdminNavGroup,
): CollectionConfig {
  if (collection.admin?.group === false) {
    return collection
  }

  if (collection.admin?.group) {
    return collection
  }

  return {
    ...collection,
    admin: {
      ...collection.admin,
      group: defaultUngroupedGroup,
    },
  }
}

function withExplicitGlobalGroup(
  global: GlobalConfig,
  defaultUngroupedGroup: AdminNavGroup,
): GlobalConfig {
  if (global.admin?.group === false) {
    return global
  }

  if (global.admin?.group) {
    return global
  }

  return {
    ...global,
    admin: {
      ...global.admin,
      group: defaultUngroupedGroup,
    },
  }
}

function sortEntitiesByNavGroup<T extends CollectionConfig | GlobalConfig>(
  entities: T[],
  defaultUngroupedGroup: AdminNavGroup,
): T[] {
  const defaultPriority = ADMIN_NAV_GROUP_ORDER.length

  return [...entities]
    .map((entity, index) => ({ entity, index }))
    .sort((a, b) => {
      const groupA = resolveGroup(a.entity, defaultUngroupedGroup)
      const groupB = resolveGroup(b.entity, defaultUngroupedGroup)

      if (groupA === HIDDEN_GROUP && groupB !== HIDDEN_GROUP) return 1
      if (groupB === HIDDEN_GROUP && groupA !== HIDDEN_GROUP) return -1

      const priorityA =
        groupA === UNGROUPED_GROUP
          ? groupPriority.get(defaultUngroupedGroup) ?? defaultPriority
          : groupPriority.get(groupA) ?? defaultPriority
      const priorityB =
        groupB === UNGROUPED_GROUP
          ? groupPriority.get(defaultUngroupedGroup) ?? defaultPriority
          : groupPriority.get(groupB) ?? defaultPriority

      if (priorityA !== priorityB) {
        return priorityA - priorityB
      }

      const withinA = getWithinGroupPriority(a.entity, groupA, defaultUngroupedGroup)
      const withinB = getWithinGroupPriority(b.entity, groupB, defaultUngroupedGroup)

      if (withinA !== withinB) {
        return withinA - withinB
      }

      return a.index - b.index
    })
    .map(({ entity }) => entity)
}

export function sortAdminNavGroupsPlugin(): Plugin {
  return (config: Config): Config => {
    const defaultUngroupedGroup: AdminNavGroup = 'Collection'

    const collections = sortEntitiesByNavGroup(
      (config.collections ?? []).map((collection) =>
        withExplicitCollectionGroup(collection, defaultUngroupedGroup),
      ),
      defaultUngroupedGroup,
    )

    const globals = sortEntitiesByNavGroup(
      (config.globals ?? []).map((global) =>
        withExplicitGlobalGroup(global, defaultUngroupedGroup),
      ),
      defaultUngroupedGroup,
    )

    return {
      ...config,
      collections,
      globals,
    }
  }
}
