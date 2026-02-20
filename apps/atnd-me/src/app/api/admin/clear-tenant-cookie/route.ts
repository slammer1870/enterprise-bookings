/**
 * Clears the payload-tenant cookie so the admin sidebar shows "all tenants".
 * Call this when the user clicks the X to deselect the tenant (e.g. on the dashboard).
 * When request is from a subdomain, also clear with Domain=.rootHostname so the
 * domain-scoped cookie (set by client on subdomain) is removed.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import { getCurrentUser } from '@/lib/stripe-connect/api-helpers'
import { checkRole } from '@repo/shared-utils'

const COOKIE_NAME = 'payload-tenant'

function getRootHostname(): string | null {
  const url = process.env.NEXT_PUBLIC_SERVER_URL
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

function clearCookieHeader(path: string, domain?: string | null): string {
  const domainAttr = domain ? `; Domain=${domain}` : ''
  return `${COOKIE_NAME}=; Path=${path}; Max-Age=0; SameSite=Lax${domainAttr}`
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    const user = await getCurrentUser(payload, request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!checkRole(['admin', 'tenant-admin'], user as Parameters<typeof checkRole>[1])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const res = NextResponse.json({ ok: true })
    // Clear for both path=/ and path=/admin so the cookie is gone regardless of how the plugin set it
    res.headers.append('Set-Cookie', clearCookieHeader('/'))
    res.headers.append('Set-Cookie', clearCookieHeader('/admin'))
    res.headers.append('Set-Cookie', clearCookieHeader('/admin/'))

    // When admin is accessed via subdomain, client sets cookie with Domain=.rootHostname.
    // Clear that too so the domain-scoped cookie is removed.
    const rootHostname = getRootHostname()
    const requestHost = request.headers.get('host')?.split(':')[0] ?? ''
    const isSubdomain =
      rootHostname &&
      requestHost !== rootHostname &&
      (requestHost.endsWith('.' + rootHostname) || requestHost.endsWith('.localhost'))
    if (isSubdomain && rootHostname) {
      const domain = rootHostname === 'localhost' ? '.localhost' : `.${rootHostname}`
      res.headers.append('Set-Cookie', clearCookieHeader('/', domain))
      res.headers.append('Set-Cookie', clearCookieHeader('/admin', domain))
      res.headers.append('Set-Cookie', clearCookieHeader('/admin/', domain))
    }

    return res
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to clear tenant cookie'
    if (process.env.NODE_ENV === 'development') {
      console.error('[api/admin/clear-tenant-cookie]', err)
      return NextResponse.json({ error: message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Failed to clear tenant cookie' }, { status: 500 })
  }
}
