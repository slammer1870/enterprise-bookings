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

/**
 * Resolve tenant email branding context from a magic-link / reset URL hostname.
 */
export async function resolveTenantForMagicLinkUrl(
  magicLinkUrl: string,
): Promise<TenantEmailFromContext | null> {
  let hostname = ''
  try {
    hostname = new URL(magicLinkUrl).hostname.toLowerCase()
  } catch {
    return null
  }

  if (!hostname) return null

  async function findTenantBySlug(slug: string): Promise<TenantEmailFromContext | null> {
    if (!slug) return null
    const { getPayload } = await import('@/lib/payload')
    const payload = await getPayload()
    const result = await payload.find({
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
    const { getPayload } = await import('@/lib/payload')
    const payload = await getPayload()
    const result = await payload.find({
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
  try {
    const platformHost = new URL(getServerSideURL()).hostname.toLowerCase()
    if (platformHost && hostname !== platformHost && hostname.endsWith('.' + platformHost)) {
      const first = hostname.split('.')[0]
      if (first) {
        return await findTenantBySlug(first)
      }
    }
  } catch {
    // Ignore and fall through to custom-domain lookup
  }

  // Custom domain: match tenants.domain
  const normalized = normalizeCustomDomain(hostname)
  if (!normalized) return null

  return await findTenantByDomain(normalized)
}
