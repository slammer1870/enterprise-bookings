export type PathHelpersOptions = {
  collectionsRequireTenantOnCreate?: string[] | Set<string>
  collectionsCreateRequireTenantForTenantAdmin?: string[] | Set<string>
}

function toSet(value: string[] | Set<string> | undefined): Set<string> {
  if (value == null) return new Set()
  return value instanceof Set ? value : new Set(value)
}

export function createPathHelpers(options: PathHelpersOptions = {}) {
  return {
    isTenantRequiredCreatePath(pathname: string | null): boolean {
      return isTenantRequiredCreatePath(pathname, options)
    },
    isCreateRequireTenantForTenantAdminPath(pathname: string | null): boolean {
      return isCreateRequireTenantForTenantAdminPath(pathname, options)
    },
  }
}

export function isTenantRequiredCreatePath(
  pathname: string | null,
  options: PathHelpersOptions = {},
): boolean {
  if (typeof pathname !== 'string') return false
  const match = pathname.match(/\/collections\/([^/]+)\/create$/)
  const slug = match?.[1]
  return slug != null && toSet(options.collectionsRequireTenantOnCreate).has(slug)
}

export function isCreateRequireTenantForTenantAdminPath(
  pathname: string | null,
  options: PathHelpersOptions = {},
): boolean {
  if (typeof pathname !== 'string') return false
  const match = pathname.match(/\/collections\/([^/]+)\/create$/)
  const slug = match?.[1]
  return slug != null && toSet(options.collectionsCreateRequireTenantForTenantAdmin).has(slug)
}

/**
 * Returns collection slug and document id when pathname is a collection edit page
 * (e.g. /admin/collections/pages/123). Returns null for create or non-edit paths.
 */
export function getCollectionEditParams(
  pathname: string | null,
): { collectionSlug: string; docId: string } | null {
  if (typeof pathname !== 'string') return null
  const match = pathname.match(/^\/?admin\/collections\/([^/]+)\/([^/]+)$/)
  if (!match) return null
  const [, collectionSlug, docId] = match
  if (!collectionSlug || !docId || docId === 'create') return null
  return { collectionSlug, docId }
}

