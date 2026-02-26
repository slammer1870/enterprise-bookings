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

