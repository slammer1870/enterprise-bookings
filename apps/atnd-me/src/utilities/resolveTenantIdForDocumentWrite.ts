import {
  getPayloadTenantIdFromRequest,
  getTenantSlugFromRequest,
  isBaseHostRequest,
} from '@/utilities/tenantRequest'

/**
 * Request shape when inferring tenant for writes (pages, posts, etc.).
 * Looser than PayloadRequest so hooks and block helpers can pass partial req objects.
 */
export type TenantDocumentWriteReq = {
  context?: { tenant?: unknown; __resolvedTenantIdFromSlug?: unknown; __resolvedTenantIdFromHost?: unknown }
  cookies?: { get?: (name: string) => { value?: string } | undefined }
  headers?: { get?: (name: string) => string | null }
  payload?: {
    find: (args: Record<string, unknown>) => Promise<{ docs?: Array<{ id?: number | string }> } | null | undefined>
  }
}

export function getTenantIdFromDocumentRequestSync(req: TenantDocumentWriteReq): number | string | null {
  const ctxTenant = req.context?.tenant
  if (ctxTenant) {
    return typeof ctxTenant === 'object' && ctxTenant !== null && 'id' in ctxTenant
      ? (ctxTenant as { id: number | string }).id
      : (ctxTenant as number | string)
  }

  const cachedTenantId =
    req.context?.__resolvedTenantIdFromSlug ?? req.context?.__resolvedTenantIdFromHost ?? null
  if (typeof cachedTenantId === 'number' || typeof cachedTenantId === 'string') {
    return cachedTenantId
  }

  const headerGetter = req.headers?.get?.bind(req.headers)
  const cookieHeader = headerGetter?.('cookie') ?? ''
  const getCookieFromHeader = (name: string): string | null => {
    if (!cookieHeader) return null
    const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
    if (!m?.[1]) return null
    try {
      return decodeURIComponent(m[1])
    } catch {
      return m[1]
    }
  }

  const payloadTenantFromHeaderRaw = getCookieFromHeader('payload-tenant')
  const payloadTenantFromHeader =
    payloadTenantFromHeaderRaw && /^\d+$/.test(payloadTenantFromHeaderRaw)
      ? parseInt(payloadTenantFromHeaderRaw, 10)
      : null

  return getPayloadTenantIdFromRequest({ cookies: req.cookies, headers: req.headers }) ?? payloadTenantFromHeader
}

/**
 * Resolution for writes: context, cookies, base host, then slug lookup.
 * Use in beforeValidate when the tenant relationship is empty so slug / selector context still applies.
 */
export async function resolveTenantIdForDocumentWrite(
  req: TenantDocumentWriteReq,
): Promise<number | string | null> {
  const syncTenantId = getTenantIdFromDocumentRequestSync(req)
  if (typeof syncTenantId === 'number' || typeof syncTenantId === 'string') {
    return syncTenantId
  }

  const cookieStore = req.cookies
  const headerGetter = req.headers?.get?.bind(req.headers)
  const cookieHeader = headerGetter?.('cookie') ?? ''
  const getCookieFromHeader = (name: string): string | null => {
    if (!cookieHeader) return null
    const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
    if (!m?.[1]) return null
    try {
      return decodeURIComponent(m[1])
    } catch {
      return m[1]
    }
  }

  const payloadTenantFromHeaderRaw = getCookieFromHeader('payload-tenant')
  const payloadTenantFromHeader =
    payloadTenantFromHeaderRaw && /^\d+$/.test(payloadTenantFromHeaderRaw)
      ? parseInt(payloadTenantFromHeaderRaw, 10)
      : null

  const cachedTenantId =
    req.context?.__resolvedTenantIdFromSlug ?? req.context?.__resolvedTenantIdFromHost ?? null
  if (typeof cachedTenantId === 'number' || typeof cachedTenantId === 'string') {
    return cachedTenantId
  }

  const payloadTenantId =
    getPayloadTenantIdFromRequest({ cookies: cookieStore, headers: req.headers }) ?? payloadTenantFromHeader
  if (isBaseHostRequest(req.headers)) {
    return payloadTenantId
  }

  const tenantSlug =
    getTenantSlugFromRequest({
      cookies: cookieStore,
      headers: req.headers,
    }) ?? getCookieFromHeader('tenant-slug') ?? null
  if (!tenantSlug || !req.payload) return null

  const result = await req.payload
    .find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      select: { id: true },
      req,
    })
    .catch(() => null)

  const tenantId = result?.docs?.[0]?.id
  if (typeof tenantId === 'number' || typeof tenantId === 'string') return tenantId

  return payloadTenantId
}
