import { createBetterAuthPluginOptions, createCustomExpiryMagicLinkSender } from '@repo/better-auth-config/server'
import { customSession } from 'better-auth/plugins'
import { buildSanitizedBetterAuthCustomSession, sanitizeTenantMemberships } from '@repo/shared-utils'
import { getServerSideURL } from '@/utilities/getURL'
import { normalizeCustomDomain } from '@/utilities/validateCustomDomain'
import { registrationTenantDatabaseHooks } from '@/lib/auth/registration-tenant-database-hooks'
import { sanitizeFromAddress, sanitizeFromName } from '@/utilities/emailConfig'

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
  // Playwright custom-domain tests use http://*.nip.io:3000; DB stores hostnames as https-only otherwise.
  // Match payload.config.ts: any truthy PW_E2E_PROFILE (not only the string "true").
  const e2eHttpPort = process.env.PW_E2E_PROFILE ? (process.env.PORT || '3000').trim() : null

  const extra = customDomains
    .filter((d) => d && typeof d === 'string' && d.trim() !== '')
    .flatMap((d) => {
      const value = d.trim()
      const lower = value.toLowerCase()
      // Support either:
      // - hostnames (e.g. "studio.example.com") -> "https://studio.example.com"
      // - full origins (e.g. "http://new.brugrappling.ie") -> "http://new.brugrappling.ie"
      if (lower.startsWith('http://') || lower.startsWith('https://')) {
        try {
          const u = new URL(lower)
          if (u.protocol === 'http:' || u.protocol === 'https:') return [u.origin]
        } catch {
          return []
        }
        return []
      }
      const host = lower.split('/')[0]?.split(':')[0] ?? lower
      const out = [`https://${host}`]
      if (e2eHttpPort && /^\d+$/.test(e2eHttpPort)) {
        out.push(`http://${host}:${e2eHttpPort}`)
      }
      return out
    })
  return [...base, ...extra]
}

/** Extra trusted origins (e.g. tenant custom domains). Comma-separated hostnames. */
export function getExtraTrustedOriginHosts(): string[] {
  const raw = process.env.BETTER_AUTH_TRUSTED_ORIGINS_EXTRA
  if (!raw || typeof raw !== 'string') return []
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

type TenantDomainCacheEntry = { ok: boolean; atMs: number }
const tenantDomainCache = new Map<string, TenantDomainCacheEntry>()

type TenantDomainsCacheAllEntry = { domains: string[]; atMs: number }
let tenantDomainsAllCache: TenantDomainsCacheAllEntry | null = null

async function isTenantCustomDomain(hostname: string): Promise<boolean> {
  const now = Date.now()
  // In E2E, tenants are created after the webServer boots; avoid stale cache.
  const ttlMs = process.env.PW_E2E_PROFILE ? 0 : 5 * 60_000
  const cached = tenantDomainCache.get(hostname)
  if (cached && now - cached.atMs < ttlMs) return cached.ok

  try {
    const { getPayload } = await import('@/lib/payload')
    const payload = await getPayload()
    const result = await payload.find({
      collection: 'tenants',
      where: { domain: { equals: hostname } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      select: { id: true } as any,
    })
    const ok = Boolean(result.docs[0])
    tenantDomainCache.set(hostname, { ok, atMs: now })
    return ok
  } catch {
    // Fail closed: if we can't verify, don't trust the origin.
    tenantDomainCache.set(hostname, { ok: false, atMs: now })
    return false
  }
}

async function getAllTenantCustomDomains(): Promise<string[]> {
  const now = Date.now()
  // In E2E, tenants are created after the webServer boots; avoid stale cache.
  const ttlMs = process.env.PW_E2E_PROFILE ? 0 : 5 * 60_000
  if (tenantDomainsAllCache && now - tenantDomainsAllCache.atMs < ttlMs) {
    return tenantDomainsAllCache.domains
  }

  try {
    const { getPayload } = await import('@/lib/payload')
    const payload = await getPayload()
    const result = await payload.find({
      collection: 'tenants',
      where: { domain: { exists: true } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
      select: { domain: true } as any,
    })

    const domains = (result.docs as Array<{ domain?: unknown }>)
      .map((d) => (d?.domain != null ? String(d.domain) : ''))
      .map((d) => normalizeCustomDomain(d) || '')
      .filter(Boolean)

    tenantDomainsAllCache = { domains, atMs: now }
    return domains
  } catch {
    // Fail closed: if we can't load tenant domains, don't trust extra origins.
    tenantDomainsAllCache = { domains: [], atMs: now }
    return []
  }
}

async function trustedOriginsFromRequest(request: Request): Promise<string[]> {
  // Include:
  // - platform origins (+ wildcard subdomains)
  // - optional env-provided extras (kept for emergency overrides)
  // - *all* tenant custom domains from DB so Better Auth can validate callbackURL even when
  //   the request lacks an Origin header (common for some auth flows / proxies).
  const allTenantDomains = await getAllTenantCustomDomains()
  const base = getTrustedOriginsWithCustomDomains([
    ...getExtraTrustedOriginHosts(),
    ...allTenantDomains,
  ])
  if (
    process.env.E2E_DEBUG_TRUSTED_ORIGINS &&
    process.env.PW_E2E_PROFILE &&
    allTenantDomains.some((d) => d.includes('nip.io'))
  ) {
    // eslint-disable-next-line no-console
    console.log('[trustedOriginsFromRequest debug base]', {
      allTenantDomainsCount: allTenantDomains.length,
      nipIoDomains: allTenantDomains.filter((d) => d.includes('nip.io')).slice(0, 5),
      baseCount: base.length,
    })
  }

  const originHeader = request.headers.get('origin') || ''
  if (!originHeader) return base

  let origin: URL
  try {
    origin = new URL(originHeader)
  } catch {
    return base
  }

  const hostname = normalizeCustomDomain(origin.hostname)
  if (!hostname) return base

  // E2E / Playwright uses http://host:3000 for both platform and tenant custom domains.
  // Allow HTTP origins during tests to avoid rejecting callbackURL validation.
  if (origin.protocol === 'http:' && process.env.PW_E2E_PROFILE) {
    const trusted = [...new Set([...base, origin.origin])]
    if (process.env.E2E_DEBUG_TRUSTED_ORIGINS && hostname.includes('nip.io')) {
      // eslint-disable-next-line no-console
      console.log('[trustedOriginsFromRequest debug]', {
        originHeader,
        hostname,
        originOrigin: origin.origin,
        trustedHasOrigin: trusted.includes(origin.origin),
        trustedCount: trusted.length,
      })
    }
    return trusted
  }

  const isTenant = await isTenantCustomDomain(hostname)
  if (!isTenant) return base

  // Enforce https origins only (we redirect http->https at the edge/app).
  if (origin.protocol !== 'https:') return base

  // Return platform origins + the specific tenant origin that made the request.
  // (Better Auth validates Origin exactly; we do not wildcard custom domains.)
  return [...new Set([...base, origin.origin])]
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
      select: { name: true, domain: true } as any,
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
      select: { name: true, domain: true } as any,
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

const BOOKING_MAGIC_LINK_EXPIRY_SECONDS = 36 * 60 * 60 // 36 hours

function resolveTenantBasedBetterAuthFrom(args: { tenantName?: string | null; tenantDomain?: string | null }) {
  const fromName = sanitizeFromName(args.tenantName) || 'ATND ME'

  // Resend requires a syntactically valid email address, and the sender domain must be
  // verified. Better Auth already retries with `DEFAULT_FROM_ADDRESS` when Resend rejects
  // unverified domains, so we only sanitize to prevent malformed `from` headers (422s).
  const normalizedDomain = args.tenantDomain ? normalizeCustomDomain(args.tenantDomain) : null
  const fromAddressEmail = normalizedDomain ? `auth@${normalizedDomain}` : 'auth@atnd.me'

  return {
    fromName,
    fromAddress: sanitizeFromAddress(fromAddressEmail) || 'auth@atnd.me',
  }
}

const betterAuthConfig = {
  appName: 'ATND ME',
  adminUserIds: ['1'],
  enableMagicLink: true,
  magicLinkDisableSignUp: true,
  includeMagicLinkOptionConfig: true,
  cookieDomainStrategy: 'host' as const,
  disableDefaultPayloadAuth: false,
  hidePluginCollections: true,
  databaseHooks: registrationTenantDatabaseHooks,
  trustedOrigins: trustedOriginsFromRequest,
  resolveMagicLinkAppName: async ({ url }: { url: string }) => (await resolveTenantForMagicLinkUrl(url))?.name ?? null,
  resolveMagicLinkEmailContent: ({ url }: { url: string }) => {
    try {
      const callbackURL = new URL(url).searchParams.get('callbackURL') ?? ''
      const callbackPath = callbackURL.startsWith('http')
        ? new URL(callbackURL).pathname
        : callbackURL
      if (/^\/bookings\/[^/]+\/manage/.test(callbackPath)) {
        return {
          instructions: `You have a pending booking that needs to be completed. Click the button below to complete your booking. This link expires in 36 hours.`,
          ctaText: 'Complete your booking',
        }
      }
    } catch {
      // ignore unparseable URLs
    }
    return null
  },
  resolveMagicLinkFrom: async ({ url }: { url: string }) => {
    const tenant = await resolveTenantForMagicLinkUrl(url)
    return resolveTenantBasedBetterAuthFrom({ tenantName: tenant?.name, tenantDomain: tenant?.domain })
  },
  resolveResetPasswordAppName: async ({ url }: { url: string }) => (await resolveTenantForMagicLinkUrl(url))?.name ?? null,
  resolveResetPasswordFrom: async ({ url }: { url: string }) => {
    const tenant = await resolveTenantForMagicLinkUrl(url)
    return resolveTenantBasedBetterAuthFrom({ tenantName: tenant?.name, tenantDomain: tenant?.domain })
  },
  roles: {
    adminRoles: ['super-admin', 'admin', 'staff', 'location-manager'],
    defaultRole: 'user',
    defaultAdminRole: 'super-admin',
    roles: ['user', 'staff', 'admin', 'super-admin', 'location-manager'],
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
}

const _betterAuthPluginOptionsBase = createBetterAuthPluginOptions(betterAuthConfig)

/**
 * `customSession` injects `tenants` (with per-tenant roles) into Better Auth sessions for
 * portal users. This makes `req.user.tenants` reliably available in access control helpers
 * without a per-request DB lookup, eliminating `loadUserDocForTenantMembership` as a
 * primary path for tenant admin scope resolution.
 *
 * Scope guard: only portal users (admin, staff, location-manager, super-admin) incur the
 * extra DB query. Regular booking users are skipped entirely.
 */
const PORTAL_ROLES = new Set(['admin', 'staff', 'location-manager', 'super-admin'])

const customSessionPlugin = customSession(async ({ user, session }: {
  user: Record<string, unknown>
  session: Record<string, unknown>
}) => {
  const roles = Array.isArray(user.role) ? user.role : user.role ? [user.role] : []
  const isPortalUser = (roles as string[]).some((r) => PORTAL_ROLES.has(r))
  if (!isPortalUser) return { user, session }

  let tenantsOverride: ReturnType<typeof sanitizeTenantMemberships> = undefined
  try {
    const { getPayload } = await import('@/lib/payload')
    const payload = await getPayload()
    const full = await payload.findByID({
      collection: 'users',
      id: Number(user.id),
      depth: 0,
      overrideAccess: true,
      select: { tenants: true } as Record<string, boolean>,
    })
    tenantsOverride = sanitizeTenantMemberships((full as unknown as Record<string, unknown>)?.tenants)
  } catch {
    // Fall through — portal user still gets a sanitized session without tenants.
  }

  const slim = buildSanitizedBetterAuthCustomSession({ user, session }, { tenantsOverride })
  if (!slim) return { user, session }
  return slim
})

export const betterAuthPluginOptions = {
  ..._betterAuthPluginOptionsBase,
  betterAuthOptions: {
    ..._betterAuthPluginOptionsBase.betterAuthOptions,
    plugins: [
      ...(_betterAuthPluginOptionsBase.betterAuthOptions?.plugins ?? []),
      customSessionPlugin,
    ],
  },
}

/**
 * Sends a booking completion magic link with a 36-hour expiry,
 * bypassing Better Auth's global `signInMagicLink` (which has a fixed global expiry).
 */
export const sendBookingCompletionMagicLink = createCustomExpiryMagicLinkSender({
  ...betterAuthConfig,
  // Expose the correct expiry so the email display text reflects "36 hours"
  magicLinkExpiresIn: BOOKING_MAGIC_LINK_EXPIRY_SECONDS,
})

export type ConstructedBetterAuthPluginOptions = typeof betterAuthPluginOptions
