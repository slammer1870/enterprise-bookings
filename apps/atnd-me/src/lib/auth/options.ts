import { createBetterAuthPluginOptions } from '@repo/better-auth-config/server'
import { getServerSideURL } from '@/utilities/getURL'
import { normalizeCustomDomain } from '@/utilities/validateCustomDomain'

/**
 * Generate trusted origins for Better Auth, including wildcard patterns for tenant subdomains.
 * Exported for unit tests.
 */
export function getTrustedOrigins(): string[] {
  const baseURL = getServerSideURL()
  const url = new URL(baseURL)
  const isLocalhost = url.hostname.includes('localhost')
  const protocol = url.protocol
  const hostname = url.hostname
  const port = url.port ? `:${url.port}` : ''

  const origins: string[] = [baseURL] // Always include the base URL

  if (isLocalhost) {
    origins.push(`${protocol}//*.localhost${port}`)
  } else {
    // Use full hostname so *.atnd-me.com works (not *.me.com)
    origins.push(`${protocol}//*.${hostname}`)
  }

  return origins
}

/**
 * Platform origins plus https:// for each tenant custom domain.
 * Use when building trusted origins that include custom domains (e.g. from DB or env).
 */
export function getTrustedOriginsWithCustomDomains(
  customDomains: string[]
): string[] {
  const base = getTrustedOrigins()
  const extra = customDomains
    .filter((d) => d && typeof d === 'string' && d.trim() !== '')
    .map((d) => d.trim())
    .map((value) => {
      const lower = value.toLowerCase()
      // Support either:
      // - hostnames (e.g. "studio.example.com") -> "https://studio.example.com"
      // - full origins (e.g. "http://new.brugrappling.ie") -> "http://new.brugrappling.ie"
      if (lower.startsWith('http://') || lower.startsWith('https://')) {
        try {
          const u = new URL(lower)
          if (u.protocol === 'http:' || u.protocol === 'https:') return u.origin
        } catch {
          // fall through
        }
      }
      return `https://${lower}`
    })
  return [...base, ...extra]
}

/** Extra trusted origins (e.g. tenant custom domains). Comma-separated hostnames. */
function getExtraTrustedOriginHosts(): string[] {
  const raw = process.env.BETTER_AUTH_TRUSTED_ORIGINS_EXTRA
  if (!raw || typeof raw !== 'string') return []
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

async function resolveTenantForMagicLinkUrl(magicLinkUrl: string): Promise<{ name: string; domain?: string | null } | null> {
  let hostname = ''
  try {
    hostname = new URL(magicLinkUrl).hostname.toLowerCase()
  } catch {
    return null
  }

  if (!hostname) return null

  async function findTenantBySlug(slug: string): Promise<{ name: string; domain?: string | null } | null> {
    if (!slug) return null
    const { getPayload } = await import('@/lib/payload')
    const payload = await getPayload()
    const result = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const tenant = result.docs[0] as { name?: unknown; domain?: unknown } | undefined
    const name = tenant?.name != null ? String(tenant.name).trim() : ''
    const domain = tenant?.domain != null ? String(tenant.domain).trim() : null
    return name ? { name, domain: domain || null } : null
  }

  async function findTenantByDomain(domain: string): Promise<{ name: string; domain?: string | null } | null> {
    const { getPayload } = await import('@/lib/payload')
    const payload = await getPayload()
    const result = await payload.find({
      collection: 'tenants',
      where: { domain: { equals: domain } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const tenant = result.docs[0] as { name?: unknown; domain?: unknown } | undefined
    const name = tenant?.name != null ? String(tenant.name).trim() : ''
    const storedDomain = tenant?.domain != null ? String(tenant.domain).trim() : ''
    return name ? { name, domain: storedDomain || domain } : null
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

export const betterAuthPluginOptions = createBetterAuthPluginOptions({
  appName: 'ATND ME',
  adminUserIds: ['1'],
  enableMagicLink: true,
  magicLinkDisableSignUp: true,
  includeMagicLinkOptionConfig: true,
  cookieDomainStrategy: 'host',
  disableDefaultPayloadAuth: false,
  hidePluginCollections: true,
  trustedOrigins: getTrustedOriginsWithCustomDomains(getExtraTrustedOriginHosts()),
  resolveMagicLinkAppName: async ({ url }) => (await resolveTenantForMagicLinkUrl(url))?.name ?? null,
  resolveMagicLinkFrom: async ({ url }) => {
    const tenant = await resolveTenantForMagicLinkUrl(url)
    const fromName = tenant?.name || 'ATND ME'
    const fromAddress = tenant?.domain ? `auth@${tenant.domain}` : 'auth@atnd.me'
    return { fromName, fromAddress }
  },
  roles: {
    adminRoles: ['admin', 'tenant-admin'],
    defaultRole: 'user',
    defaultAdminRole: 'admin',
    roles: ['user', 'admin', 'tenant-admin'],
    allowedFields: ['name'],
  },
  sessionExpiresInSeconds: 60 * 60 * 24 * 365, // 1 year
  sessionUpdateAgeSeconds: 60 * 60 * 24 * 30,  // refresh every 30 days of activity
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        socialProviders: {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        },
      }
    : {}),
})

export type ConstructedBetterAuthPluginOptions = typeof betterAuthPluginOptions
