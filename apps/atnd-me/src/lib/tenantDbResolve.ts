import type { Payload } from 'payload'

export type TenantIdSlug = { id: number | string; slug: string }

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
