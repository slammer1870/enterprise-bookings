import type { Payload } from 'payload'

export type TenantIdSlug = { id: number | string; slug: string }

export type HostResolution =
  | { type: 'domain'; id: number | string; slug: string }
  | { type: 'apex'; id: number | string; slug: string; wwwDomain: string }

/**
 * Shared tenant lookups for middleware-backed routes (Node runtime).
 * Uses tight `select` + `depth: 0` to minimize Postgres payload vs full documents.
 */
export async function findTenantByDomainNormalized(
  payload: Payload,
  normalizedDomain: string,
): Promise<TenantIdSlug | null> {
  const result = await payload.find({
    collection: 'tenants',
    where: { domain: { equals: normalizedDomain } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { id: true, slug: true } as Record<string, boolean>,
  })

  const tenant = result.docs[0] as { id?: unknown; slug?: unknown } | undefined
  if (!tenant?.slug || tenant.id == null) return null

  return { id: tenant.id as number | string, slug: String(tenant.slug) }
}

/**
 * Resolves a request hostname to a tenant in a single OR query:
 *   WHERE domain = :host OR apex_domain = :host
 *
 * Returns a discriminated union so the caller knows whether to serve
 * normally (type='domain') or issue an apex → www redirect (type='apex').
 * Keeps findTenantByDomainNormalized for existing callers that don't need
 * the discriminant (trusted-origins, CORS).
 */
export async function findTenantByHost(
  payload: Payload,
  normalizedHost: string,
): Promise<HostResolution | null> {
  const result = await payload.find({
    collection: 'tenants',
    where: {
      or: [
        { domain: { equals: normalizedHost } },
        { apexDomain: { equals: normalizedHost } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { id: true, slug: true, domain: true, apexDomain: true } as Record<string, boolean>,
  })

  const tenant = result.docs[0] as {
    id?: unknown
    slug?: unknown
    domain?: unknown
    apexDomain?: unknown
  } | undefined

  if (!tenant?.slug || tenant.id == null) return null

  const id = tenant.id as number | string
  const slug = String(tenant.slug)
  const domain = typeof tenant.domain === 'string' ? tenant.domain : null
  const apexDomain = typeof tenant.apexDomain === 'string' ? tenant.apexDomain : null

  // Apex hit: the host matched the stored apex_domain column
  if (apexDomain && apexDomain === normalizedHost && domain) {
    return { type: 'apex', id, slug, wwwDomain: domain }
  }

  return { type: 'domain', id, slug }
}

export async function findTenantBySlugNormalized(
  payload: Payload,
  slugLower: string,
): Promise<TenantIdSlug | null> {
  const result = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slugLower } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { id: true, slug: true } as Record<string, boolean>,
  })

  const tenant = result.docs[0] as { id?: unknown; slug?: unknown } | undefined
  if (!tenant?.slug || tenant.id == null) return null

  return { id: tenant.id as number | string, slug: String(tenant.slug) }
}
