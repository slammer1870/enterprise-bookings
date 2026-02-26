import type { PayloadRequest } from 'payload'

import type { TenantOption } from '../types'

const DEFAULT_TENANTS_ARRAY_FIELD_NAME = 'tenants'
const DEFAULT_TENANTS_ARRAY_TENANT_FIELD_NAME = 'tenant'
const DEFAULT_USE_AS_TITLE = 'name'

function defaultUserHasAccessToAllTenants(user: unknown): boolean {
  if (!user) return false
  const u = user as { roles?: string[] }
  return Array.isArray(u.roles) && u.roles.includes('admin')
}

export type PopulateTenantOptionsOptions = {
  tenantsCollectionSlug?: string
  tenantsArrayFieldName?: string
  tenantsArrayTenantFieldName?: string
  useAsTitle?: string
  userHasAccessToAllTenants?: (user: unknown) => boolean | Promise<boolean>
}

/**
 * Returns a GET handler for the tenants collection that responds with
 * { tenantOptions: [{ label, value, slug? }, ...] } for the authenticated user.
 * Used by TenantSelectionProviderRootAwareClient when server did not pass initial options.
 */
export function createPopulateTenantOptionsHandler(
  options: PopulateTenantOptionsOptions = {},
): (req: PayloadRequest) => Promise<Response> {
  const tenantsCollectionSlug = options.tenantsCollectionSlug ?? 'tenants'
  const tenantsArrayFieldName = options.tenantsArrayFieldName ?? DEFAULT_TENANTS_ARRAY_FIELD_NAME
  const tenantsArrayTenantFieldName =
    options.tenantsArrayTenantFieldName ?? DEFAULT_TENANTS_ARRAY_TENANT_FIELD_NAME
  const useAsTitle = options.useAsTitle ?? DEFAULT_USE_AS_TITLE
  const userHasAccessToAllTenants =
    typeof options.userHasAccessToAllTenants === 'function'
      ? options.userHasAccessToAllTenants
      : defaultUserHasAccessToAllTenants

  return async (req: PayloadRequest): Promise<Response> => {
    const payload = req.payload
    // In collection endpoints (especially non-auth collections), `req.user` may be unset.
    // Authenticate from headers to reliably get the current user.
    const cookieHeader =
      typeof (req.headers as unknown as { get?: (k: string) => string | null })?.get === 'function'
        ? (req.headers as unknown as { get: (k: string) => string | null }).get('cookie')
        : ((req.headers as unknown as Record<string, unknown>)?.cookie as string | undefined) ??
          ((req.headers as unknown as Record<string, unknown>)?.Cookie as string | undefined)
    const authHeaders = cookieHeader ? new Headers({ cookie: cookieHeader }) : req.headers
    const authResult = await payload.auth({ headers: authHeaders, canSetHeaders: false, req })
    const user = authResult?.user ?? req.user
    if (!user) return Response.json({ tenantOptions: [] })
    const coll = payload.collections[tenantsCollectionSlug as keyof typeof payload.collections]
    const isOrderable = (coll?.config as { orderable?: boolean })?.orderable ?? false
    const hasAccess = await Promise.resolve(userHasAccessToAllTenants(user))
    const userRecord = user as unknown as Record<string, unknown>
    const userTenantIds = hasAccess
      ? undefined
      : userRecord[tenantsArrayFieldName] != null
        ? (userRecord[tenantsArrayFieldName] as unknown[]).map((row) => {
            const field = (row as Record<string, unknown>)[tenantsArrayTenantFieldName]
            if (typeof field === 'string' || typeof field === 'number') return field
            if (field && typeof field === 'object' && 'id' in field)
              return (field as { id: number }).id
            return undefined
          }).filter((id): id is number | string => id !== undefined)
        : undefined

    const select: Record<string, boolean> = { [useAsTitle]: true }
    const collConfig = coll?.config as { fields?: { name: string }[] } | undefined
    const hasSlug = collConfig?.fields?.some((f) => f.name === 'slug')
    if (hasSlug) select.slug = true

    const result = await payload.find({
      collection: tenantsCollectionSlug as keyof typeof payload.collections,
      depth: 0,
      limit: 0,
      overrideAccess: false,
      select: select as Parameters<typeof payload.find>[0]['select'],
      sort: isOrderable ? '_order' : useAsTitle,
      user: user as Parameters<typeof payload.find>[0]['user'],
      ...(userTenantIds?.length ? { where: { id: { in: userTenantIds } } } : {}),
    })

    const tenantOptions: TenantOption[] = result.docs.map((doc) => {
      const d = doc as unknown as Record<string, unknown>
      return {
        label: String(d[useAsTitle]),
        value: (doc as { id: number | string }).id,
        slug: typeof d.slug === 'string' ? d.slug : undefined,
      }
    })
    return Response.json({ tenantOptions })
  }
}
