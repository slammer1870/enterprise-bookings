import type { Payload } from 'payload'

export type TenantIdSlug = { id: number | string; slug: string }

export type HostResolution =
  | { type: 'domain'; id: number | string; slug: string }
  | { type: 'alias'; id: number | string; slug: string; canonicalHost: string }

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
 * Resolves a request hostname to a tenant.
 * The stored canonical host (domain) serves. A listed alias host redirects.
 * A derived apex hostname is not a public host unless it is one of those two.
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
        { aliasHosts: { equals: normalizedHost } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { id: true, slug: true, domain: true, aliasHosts: true } as Record<string, boolean>,
  })

  const tenant = result.docs[0] as {
    id?: unknown
    slug?: unknown
    domain?: unknown
    aliasHosts?: unknown
  } | undefined

  if (!tenant?.slug || tenant.id == null) return null

  const id = tenant.id as number | string
  const slug = String(tenant.slug)
  const domain = typeof tenant.domain === 'string' ? tenant.domain : null
  const aliasHosts = Array.isArray(tenant.aliasHosts)
    ? tenant.aliasHosts.filter((host): host is string => typeof host === 'string')
    : []

  if (domain && domain === normalizedHost) {
    return { type: 'domain', id, slug }
  }

  if (aliasHosts.includes(normalizedHost)) {
    if (!domain) return null
    return { type: 'alias', id, slug, canonicalHost: domain }
  }

  return null
}

export async function findTenantBySlugNormalized(
  payload: Payload,
  slugLower: string,
): Promise<(TenantIdSlug & { domain: string | null }) | null> {
  const result = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slugLower } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { id: true, slug: true, domain: true } as Record<string, boolean>,
  })

  const tenant = result.docs[0] as { id?: unknown; slug?: unknown; domain?: unknown } | undefined
  if (!tenant?.slug || tenant.id == null) return null

  const domain = typeof tenant.domain === 'string' && tenant.domain.trim() ? tenant.domain.trim() : null
  return { id: tenant.id as number | string, slug: String(tenant.slug), domain }
}
