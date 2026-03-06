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

export type OptionalTenantRouteOptions = {
  collectionsWithTenantField?: string[] | Set<string>
  collectionsRequireTenantOnCreate?: string[] | Set<string>
  rootDocCollections?: string[] | Set<string>
}

function toSetOptional(value: string[] | Set<string> | undefined): Set<string> {
  if (value == null) return new Set()
  return value instanceof Set ? (value as Set<string>) : new Set(value)
}

/**
 * True when the current path is a collection create or edit route where the tenant
 * field is optional (user can clear the tenant). False when tenant is required.
 */
export function isOptionalTenantCollectionRoute(
  pathname: string | null,
  options: OptionalTenantRouteOptions = {},
): boolean {
  if (typeof pathname !== 'string') return true
  const { rootDocCollections = [], collectionsWithTenantField = [], collectionsRequireTenantOnCreate = [] } = options
  const rootSet = toSetOptional(rootDocCollections as string[] | Set<string>)
  const withTenantSet = toSetOptional(collectionsWithTenantField as string[] | Set<string>)
  const requireSet = toSetOptional(collectionsRequireTenantOnCreate as string[] | Set<string>)

  const rootPaths = Array.from(rootSet).map((slug) => `/collections/${slug}`)
  if (rootPaths.some((p) => pathname.includes(p))) return true

  const createMatch = pathname.match(/\/collections\/([^/]+)\/create$/)
  if (createMatch) {
    const slug = createMatch[1]
    // If the collection is configured as tenant-required, the selector must be non-clearable
    // regardless of whether we sync selector → form field for that collection.
    if (slug && requireSet.has(slug)) return false
    return true
  }
  const editParams = getCollectionEditParams(pathname)
  if (editParams?.collectionSlug) {
    if (requireSet.has(editParams.collectionSlug)) return false
    return true
  }
  return true
}

