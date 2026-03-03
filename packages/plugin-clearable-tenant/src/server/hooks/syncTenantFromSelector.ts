import type { CollectionConfig, PayloadRequest } from 'payload'

const PAYLOAD_TENANT_COOKIE = 'payload-tenant'

export type SyncTenantFromSelectorOptions = {
  documentTenantFieldName?: string
  userHasAccessToAllTenants?: (user: unknown) => boolean | Promise<boolean>
}

function getTenantIdFromRequest(req: PayloadRequest): string | number | undefined {
  const cookieStore = (req as PayloadRequest & { cookies?: { get: (name: string) => { value?: string } | undefined } })
    ?.cookies
  const value = cookieStore?.get?.(PAYLOAD_TENANT_COOKIE)?.value
  if (value === undefined || value === null || value === '') return undefined
  const trimmed = String(value).trim()
  if (trimmed === '') return undefined
  const num = /^\d+$/.test(trimmed) ? parseInt(trimmed, 10) : NaN
  return Number.isFinite(num) ? num : trimmed
}

/**
 * Creates a beforeChange hook that syncs the document's tenant field from the
 * payload-tenant cookie (set by the tenant selector). When the user changes
 * the selector and saves, the document is updated with the selected tenant.
 */
export function createSyncTenantFromSelectorHook(
  options: SyncTenantFromSelectorOptions = {},
): NonNullable<CollectionConfig['hooks']>['beforeChange'][number] {
  const documentTenantFieldName = options.documentTenantFieldName ?? 'tenant'
  const userHasAccessToAllTenants =
    typeof options.userHasAccessToAllTenants === 'function'
      ? options.userHasAccessToAllTenants
      : () => false

  return async function syncTenantFromSelector({ data, operation, req }) {
    if (operation !== 'create' && operation !== 'update') return data
    const user = req.user
    if (!user) return data
    const hasAccess = await Promise.resolve(userHasAccessToAllTenants(user))
    if (!hasAccess) return data

    const tenantId = getTenantIdFromRequest(req)
    const dataRecord = data as Record<string, unknown>
    if (tenantId === undefined || tenantId === null || tenantId === '') {
      dataRecord[documentTenantFieldName] = null
      return data
    }
    dataRecord[documentTenantFieldName] = tenantId
    return data
  }
}
