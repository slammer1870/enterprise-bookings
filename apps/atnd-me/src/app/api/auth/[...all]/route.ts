import { toNextJsHandler } from 'better-auth/next-js'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import { POST_LOGIN_REDIRECT_COOKIE } from '@/collections/Users/hooks/constants'
import { getUserTenantIDs, loadUserDocForTenantMembership } from '@/access/tenant-scoped'

const payload = await getPayload()
const betterAuthHandler = toNextJsHandler(payload.betterAuth)

function extractSubdomain(host: string): string | null {
  const hostname = (host.split(':')[0] ?? '').toLowerCase()
  if (hostname.includes('localhost')) {
    const parts = hostname.split('.')
    if (parts.length > 1 && parts[0] && parts[0] !== 'localhost') return parts[0]
    return null
  }
  try {
    const rootHost = new URL(process.env.NEXT_PUBLIC_SERVER_URL ?? '').hostname.toLowerCase()
    if (rootHost && hostname !== rootHost && hostname.endsWith(`.${rootHost}`)) {
      return hostname.split('.')[0] || null
    }
  } catch {
    // ignore
  }
  return null
}

function isSuperAdminUser(user: { role?: unknown }): boolean {
  const role = user.role
  if (Array.isArray(role)) return role.includes('super-admin')
  if (typeof role === 'string') {
    return role === 'super-admin' || role.split(',').map((r) => r.trim()).includes('super-admin')
  }
  return false
}

/**
 * POST handler wraps Better Auth's sign-in endpoint to inject a short-lived
 * redirect cookie when a super-admin with no tenant memberships logs in on a
 * tenant subdomain. The cookie is consumed by Next.js middleware on the
 * subsequent /admin navigation.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const isSignIn =
    url.pathname.endsWith('/sign-in/email') || url.pathname.endsWith('/sign-in/username')

  const res = await betterAuthHandler.POST(req)

  // eslint-disable-next-line no-console
  console.log('[auth-route] POST', url.pathname, 'isSignIn:', isSignIn, 'status:', res.status)

  if (!isSignIn || !res.ok) return res

  try {
    const host = req.headers.get('host') ?? ''
    let subdomain = extractSubdomain(host)

    // Better Auth clients are often configured with the platform base URL, so the
    // sign-in request arrives at `localhost:3000` even when the login page is on a
    // tenant subdomain. Fall back to the `Origin` header (set by the browser for
    // cross-origin requests) then `Referer` to detect the originating subdomain.
    if (!subdomain) {
      const origin = req.headers.get('origin') ?? ''
      if (origin) {
        try {
          subdomain = extractSubdomain(new URL(origin).host)
        } catch { /* ignore */ }
      }
    }
    if (!subdomain) {
      const referer = req.headers.get('referer') ?? ''
      if (referer) {
        try {
          subdomain = extractSubdomain(new URL(referer).host)
        } catch { /* ignore */ }
      }
    }

    // eslint-disable-next-line no-console
    console.log('[auth-route] host:', host, 'subdomain:', subdomain)
    if (!subdomain) return res

    const body = await res.clone().json().catch(() => null)
    const user = body?.user as { id?: unknown; role?: unknown } | undefined
    if (!user) return res

    const rawId = user.id
    const userId =
      typeof rawId === 'number'
        ? rawId
        : typeof rawId === 'string' && /^\d+$/.test(rawId)
          ? parseInt(rawId, 10)
          : NaN
    if (!Number.isFinite(userId)) return res

    // Better Auth sign-in responses often omit Payload-specific fields like `role`.
    // Load the full user from the database to get the authoritative role and tenants.
    const fullUser = await loadUserDocForTenantMembership(payload, userId).catch(() => null)
    if (!fullUser) return res

    const userRole = (fullUser as { role?: unknown }).role ?? user.role
    const isSuper = isSuperAdminUser({ role: userRole })

    // eslint-disable-next-line no-console
    console.log('[auth-route] user id:', userId, 'role:', userRole, 'isSuperAdmin:', isSuper)

    if (!isSuper) return res

    const tenantAdminIds = getUserTenantIDs(fullUser, ['admin', 'staff', 'location-manager'])

    // eslint-disable-next-line no-console
    console.log('[auth-route] tenantAdminIds.length:', tenantAdminIds.length)
    if (tenantAdminIds.length === 0) {
      // eslint-disable-next-line no-console
      console.log('[auth-route] setting redirect cookie to base')
      const headers = new Headers(res.headers)
      headers.append(
        'Set-Cookie',
        `${POST_LOGIN_REDIRECT_COOKIE}=base; Path=/; Max-Age=60; SameSite=Lax`,
      )
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
    }
  } catch {
    // If the lookup fails, fall through and return the original response.
  }

  return res
}

export const GET = betterAuthHandler.GET
