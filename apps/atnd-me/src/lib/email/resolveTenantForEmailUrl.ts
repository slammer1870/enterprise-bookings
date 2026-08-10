import { brandingFromTenantDoc } from '@/lib/email/tenant-email-branding'
import { isEmailDomainVerified } from '@/lib/resend/resolveTenantEmailFrom'
import { getServerSideURL } from '@/utilities/getURL'
import { normalizeCustomDomain } from '@/utilities/validateCustomDomain'

export type TenantEmailFromContext = {
  name: string
  domain?: string | null
  emailDomainVerified?: boolean
  logoUrl?: string | null
}

type PayloadLike = {
  find: (..._args: any[]) => Promise<{ docs: unknown[] }>
}

function tenantFromDoc(
  tenant:
    | {
        name?: unknown
        slug?: unknown
        domain?: unknown
        logo?: unknown
        emailDomainStatus?: unknown
      }
    | undefined,
  fallbackDomain?: string,
): TenantEmailFromContext | null {
  const name = tenant?.name != null ? String(tenant.name).trim() : ''
  if (!name) return null
  const domain =
    tenant?.domain != null && String(tenant.domain).trim()
      ? String(tenant.domain).trim()
      : fallbackDomain || null
  const branding = brandingFromTenantDoc(
    tenant
      ? {
          name,
          slug: tenant.slug,
          domain,
          logo: tenant.logo,
        }
      : null,
  )
  return {
    name: branding.name,
    domain,
    emailDomainVerified: isEmailDomainVerified(tenant?.emailDomainStatus),
    logoUrl: branding.logoUrl,
  }
}

const tenantEmailSelect = {
  name: true,
  slug: true,
  domain: true,
  logo: true,
  emailDomainStatus: true,
} as const

async function getPayloadClient(payload?: PayloadLike | null): Promise<PayloadLike> {
  if (payload && typeof payload.find === 'function') return payload
  const { getPayload } = await import('@/lib/payload')
  return getPayload()
}

/**
 * Resolve tenant email branding context from a magic-link / reset URL hostname.
 * Prefer passing `payload` (e.g. from `req.payload`) so unit tests and request
 * handlers avoid spinning up a fresh Payload/DB connection.
 */
export async function resolveTenantForMagicLinkUrl(
  magicLinkUrl: string,
  payload?: PayloadLike | null,
): Promise<TenantEmailFromContext | null> {
  let hostname = ''
  try {
    hostname = new URL(magicLinkUrl).hostname.toLowerCase()
  } catch {
    return null
  }

  if (!hostname) return null

  let platformHost = ''
  try {
    platformHost = new URL(getServerSideURL()).hostname.toLowerCase()
  } catch {
    platformHost = ''
  }

  // Platform apex is not a tenant host — no DB lookup.
  if (platformHost && hostname === platformHost) {
    return null
  }

  async function findTenantBySlug(slug: string): Promise<TenantEmailFromContext | null> {
    if (!slug) return null
    const client = await getPayloadClient(payload)
    const result = await client.find({
      collection: 'tenants',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 1,
      overrideAccess: true,
      select: tenantEmailSelect as any,
    })
    return tenantFromDoc(result.docs[0] as any)
  }

  async function findTenantByDomain(domain: string): Promise<TenantEmailFromContext | null> {
    const client = await getPayloadClient(payload)
    const result = await client.find({
      collection: 'tenants',
      where: { domain: { equals: domain } },
      limit: 1,
      depth: 1,
      overrideAccess: true,
      select: tenantEmailSelect as any,
    })
    return tenantFromDoc(result.docs[0] as any, domain)
  }

  // Local dev: support tenant.localhost
  if (hostname.endsWith('.localhost')) {
    const first = hostname.split('.')[0]
    if (first && first !== 'localhost') {
      return await findTenantBySlug(first)
    }
    return null
  }

  // Platform subdomain: {tenantSlug}.{platformHost}
  if (platformHost && hostname.endsWith('.' + platformHost)) {
    const first = hostname.split('.')[0]
    if (first) {
      return await findTenantBySlug(first)
    }
  }

  // Custom domain: match tenants.domain
  const normalized = normalizeCustomDomain(hostname)
  if (!normalized) return null

  return await findTenantByDomain(normalized)
}
