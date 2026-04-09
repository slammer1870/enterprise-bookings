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
const TENANT_SLUG_COOKIE_NAME = 'tenant-slug'
const TENANT_ID_COOKIE_NAME = 'tenant-id'
const TENANT_COOKIE_NAMES = [COOKIE_NAME, TENANT_SLUG_COOKIE_NAME, TENANT_ID_COOKIE_NAME]

function getRootHostname(): string | null {
  const url = process.env.NEXT_PUBLIC_SERVER_URL
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

function clearCookieHeader(name: string, path: string, domain?: string | null): string {
  const domainAttr = domain ? `; Domain=${domain}` : ''
  return `${name}=; Path=${path}; Max-Age=0; SameSite=Lax${domainAttr}`
}

function getPathsToClear(request: NextRequest): string[] {
  const basePaths = ['/', '/admin', '/admin/', '/admin/collections', '/admin/collections/']
  const rawReferer = request.headers.get('referer')

  if (!rawReferer) return basePaths

  try {
    const refererPathname = new URL(rawReferer).pathname || '/'
    const parts = refererPathname.split('/').filter(Boolean)
    const dynamicPaths = new Set<string>()

    let current = ''
    for (const part of parts) {
      current += `/${part}`
      dynamicPaths.add(current)
      dynamicPaths.add(`${current}/`)
    }

    return Array.from(new Set([...basePaths, ...dynamicPaths]))
  } catch {
    return basePaths
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    const user = await getCurrentUser(payload, request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!checkRole(['super-admin', 'admin', 'staff'], user as Parameters<typeof checkRole>[1])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const res = NextResponse.json({ ok: true })
    const pathsToClear = getPathsToClear(request)

    // Clear all known legacy admin paths so the cookie is gone regardless of how it was set.
    for (const name of TENANT_COOKIE_NAMES) {
      for (const path of pathsToClear) {
        res.headers.append('Set-Cookie', clearCookieHeader(name, path))
      }
    }

    // Also clear any domain-scoped cookie (Domain=.rootHostname). This can exist even when
    // the current request is on the root hostname (e.g. user previously visited admin on a subdomain).
    const rootHostname = getRootHostname()
    if (rootHostname) {
      const domain = rootHostname === 'localhost' ? '.localhost' : `.${rootHostname}`
      for (const name of TENANT_COOKIE_NAMES) {
        for (const path of pathsToClear) {
          res.headers.append('Set-Cookie', clearCookieHeader(name, path, domain))
        }
      }
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
