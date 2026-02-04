import type { Payload } from 'payload'

/**
 * Source for extracting tenant slug (cookies, headers, URL params).
 * Compatible with Next.js API routes, server components, and tRPC context.
 */
export type TenantSlugSource = {
  /** Cookie store (e.g. from request.cookies or await cookies()) */
  cookies?: {
    get: (name: string) => { value?: string } | undefined
  }
  /** Request headers (e.g. x-tenant-slug) */
  headers?: Headers
  /** URL search params (e.g. ?slug=tenant1) */
  searchParams?: URLSearchParams
}

/**
 * Extracts tenant slug from request-like sources.
 * Priority: cookies (tenant-slug) > x-tenant-slug header > slug search param.
 */
export async function getTenantSlug(
  source?: TenantSlugSource | null
): Promise<string | null> {
  if (!source) return null

  const cookieValue = source.cookies?.get?.('tenant-slug')?.value
  if (cookieValue) return cookieValue

  const headerValue = source.headers?.get?.('x-tenant-slug')
  if (headerValue) return headerValue

  const paramValue = source.searchParams?.get?.('slug')
  if (paramValue) return paramValue

  return null
}

export type TenantContext = {
  id: number
  slug: string
  name: string
}

/**
 * Resolves tenant context from request-like source.
 * Extracts slug via getTenantSlug, then looks up tenant in Payload.
 * Returns null if no slug or tenant not found.
 */
export async function getTenantContext(
  payload: Payload,
  source?: TenantSlugSource | null
): Promise<TenantContext | null> {
  const slug = await getTenantSlug(source)
  if (!slug) return null

  const result = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const tenant = result.docs[0]
  if (!tenant) return null

  return {
    id: tenant.id as number,
    slug: tenant.slug as string,
    name: (tenant as { name?: string }).name ?? '',
  }
}
