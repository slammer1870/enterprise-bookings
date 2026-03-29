import type { CollectionBeforeChangeHook, PayloadRequest } from 'payload'

const PAYLOAD_TENANT_COOKIE = 'payload-tenant'

export type SyncTenantFromSelectorOptions = {
  documentTenantFieldName?: string
  userHasAccessToAllTenants?: (user: unknown) => boolean | Promise<boolean>
}

type CookieAwareRequest = PayloadRequest & {
  cookies?: { get: (name: string) => { value?: string } | undefined }
}

/**
 * Reads tenant id from the payload-tenant cookie when present.
 * Returns undefined if the request has no cookie store (e.g. server-side / tests)
 * so we don't overwrite tenant set by req.context.tenant or other hooks.
 */
function getTenantIdFromRequest(req: CookieAwareRequest): string | number | undefined {
  const cookieStore = req?.cookies
  if (cookieStore === undefined) return undefined
  const value = cookieStore?.get?.(PAYLOAD_TENANT_COOKIE)?.value
  if (value === undefined || value === null || value === '') return undefined
  const trimmed = String(value).trim()
  if (trimmed === '') return undefined
  const num = /^\d+$/.test(trimmed) ? parseInt(trimmed, 10) : NaN
  return Number.isFinite(num) ? num : trimmed
}

/**
 * True when the request has a cookie store (e.g. admin UI). When false (e.g. API/tests),
 * we skip syncing so we don't overwrite tenant set by req.context.tenant or other hooks.
 */
function hasCookieStore(req: CookieAwareRequest): boolean {
  return req?.cookies !== undefined
}

/**
 * Creates a beforeChange hook that syncs the document's tenant field from the
 * payload-tenant cookie (set by the tenant selector). When the user changes
 * the selector and saves, the document is updated with the selected tenant.
 */
export function createSyncTenantFromSelectorHook(
  options: SyncTenantFromSelectorOptions = {},
): CollectionBeforeChangeHook {
  const documentTenantFieldName = options.documentTenantFieldName ?? 'tenant'
  const userHasAccessToAllTenants =
    typeof options.userHasAccessToAllTenants === 'function'
      ? options.userHasAccessToAllTenants
      : () => false

  const syncTenantFromSelector: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
    if (operation !== 'create' && operation !== 'update') return data
    const user = req.user
    if (!user) return data
    const hasAccess = await Promise.resolve(userHasAccessToAllTenants(user))
    if (!hasAccess) return data

    // Only sync when the request has a cookie store (e.g. admin UI). Server-side
    // requests (API, tests) often have no cookies; skip so we don't overwrite
    // tenant set by req.context.tenant or other hooks.
    if (!hasCookieStore(req as CookieAwareRequest)) return data

    const tenantId = getTenantIdFromRequest(req as CookieAwareRequest)
    const dataRecord = data as Record<string, unknown>
    if (tenantId === undefined || tenantId === null || tenantId === '') {
      dataRecord[documentTenantFieldName] = null
      return data
    }
    dataRecord[documentTenantFieldName] = tenantId
    return data
  }
  return syncTenantFromSelector
}
