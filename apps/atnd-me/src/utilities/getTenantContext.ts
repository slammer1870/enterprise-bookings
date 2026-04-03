import type { Payload } from 'payload'
import {
  getPayloadTenantIdFromRequest,
  getTenantSlugFromRequest,
  isBaseHostRequest,
} from './tenantRequest'

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
  return getTenantSlugFromRequest(source)
}

async function findTenantByHost(payload: Payload, headers?: Headers | null) {
  const host = headers?.get('x-forwarded-host')?.split(',')[0]?.trim() || headers?.get('host')?.trim()
  if (!host) return null

  const hostname = host.split(':')[0] ?? host
  const platformHostname = (() => {
    const url = process.env.NEXT_PUBLIC_SERVER_URL
    if (!url) return null
    try {
      return new URL(url).hostname
    } catch {
      return null
    }
  })()

  if (!hostname || hostname.includes('localhost')) return null
  if (platformHostname && (hostname === platformHostname || hostname.endsWith(`.${platformHostname}`))) {
    return null
  }

  const result = await payload.find({
    collection: 'tenants',
    where: { domain: { equals: hostname } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
    // Restrict fields; callers may only need id/slug/name/branding.
    select: {
      id: true,
      slug: true,
      name: true,
      domain: true,
      logo: true,
      description: true,
    } as any,
  })

  return result.docs[0] ?? null
}

export type TenantContext = {
  id: number
  slug: string
  name: string
  domain?: string | null
}

/**
 * Tenant with branding fields for white labeling (logo, description).
 */
export type TenantWithBranding = TenantContext & {
  logo?: { url?: string; alt?: string } | number | null
  description?: string | null
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
  if (slug) {
    const result = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      select: {
        id: true,
        slug: true,
        name: true,
        domain: true,
      } as any,
    })

    const tenant = result.docs[0]
    if (!tenant) return null

    return {
      id: tenant.id as number,
      slug: tenant.slug as string,
      name: (tenant as { name?: string }).name ?? '',
      domain: (tenant as { domain?: string | null }).domain ?? null,
    }
  }

  const tenantFromHost = await findTenantByHost(payload, source?.headers)
  if (tenantFromHost) {
    return {
      id: tenantFromHost.id as number,
      slug: tenantFromHost.slug as string,
      name: (tenantFromHost as { name?: string }).name ?? '',
      domain: (tenantFromHost as { domain?: string | null }).domain ?? null,
    }
  }

  // Fallback: Admin TenantSelector on root domain (payload-tenant cookie stores tenant ID)
  if (isBaseHostRequest(source?.headers)) return null

  const tenantId = getPayloadTenantIdFromRequest(source)
  if (!tenantId) return null
  try {
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })
    if (!tenant) return null
    const t = tenant as { id: number; slug: string; name?: string; domain?: string | null }
    return {
      id: t.id,
      slug: t.slug,
      name: t.name ?? '',
      domain: t.domain ?? null,
    }
  } catch {
    return null
  }
}

/**
 * Resolves tenant with branding fields (logo, description) for white labeling.
 * Uses depth: 1 to populate logo relation.
 *
 * Priority:
 * 1. payload-tenant cookie (tenant ID from admin TenantSelector)
 * 2. tenant-slug cookie / header / param (from subdomain)
 */
export async function getTenantWithBranding(
  payload: Payload,
  source?: TenantSlugSource | null
): Promise<TenantWithBranding | null> {
  const slug = await getTenantSlug(source)
  // Prefer explicit tenant slug (subdomain/custom-domain resolution) over admin selector cookie.
  if (slug) {
    const result = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 1,
      overrideAccess: true,
      select: {
        id: true,
        slug: true,
        name: true,
        domain: true,
        logo: true,
        description: true,
      } as any,
    })

    const tenant = result.docs[0]
    if (!tenant) return null

    const t = tenant as {
      id: number
      slug: string
      name?: string
      domain?: string | null
      logo?: { url?: string; alt?: string } | number | null
      description?: string | null
    }

    return {
      id: t.id,
      slug: t.slug,
      name: t.name ?? '',
      domain: t.domain ?? null,
      logo: t.logo,
      description: t.description,
    }
  }

  const tenantFromHost = await findTenantByHost(payload, source?.headers)
  if (tenantFromHost) {
    const t = tenantFromHost as {
      id: number
      slug: string
      name?: string
      domain?: string | null
      logo?: { url?: string; alt?: string } | number | null
      description?: string | null
    }

    return {
      id: t.id,
      slug: t.slug,
      name: t.name ?? '',
      domain: t.domain ?? null,
      logo: t.logo,
      description: t.description,
    }
  }

  // Fallback: Admin TenantSelector (payload-tenant cookie stores tenant ID)
  if (isBaseHostRequest(source?.headers)) return null

  const tenantId = getPayloadTenantIdFromRequest(source)
  if (!tenantId) return null
  try {
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 1,
      overrideAccess: true,
      select: {
        id: true,
        slug: true,
        name: true,
        domain: true,
        logo: true,
        description: true,
      } as any,
    })
    if (!tenant) return null

    const t = tenant as {
      id: number
      slug: string
      name?: string
      domain?: string | null
      logo?: { url?: string; alt?: string } | number | null
      description?: string | null
    }
    return {
      id: t.id,
      slug: t.slug,
      name: t.name ?? '',
      domain: t.domain ?? null,
      logo: t.logo,
      description: t.description,
    }
  } catch {
    return null
  }
}
