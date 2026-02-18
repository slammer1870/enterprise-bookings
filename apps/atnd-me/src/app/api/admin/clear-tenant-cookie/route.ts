/**
 * Clears the payload-tenant cookie so the admin sidebar shows "all tenants".
 * Call this when the user clicks the X to deselect the tenant (e.g. on the dashboard).
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import { getCurrentUser } from '@/lib/stripe-connect/api-helpers'
import { checkRole } from '@repo/shared-utils'

const COOKIE_NAME = 'payload-tenant'

function clearCookieHeader(path: string): string {
  return `${COOKIE_NAME}=; Path=${path}; Max-Age=0; SameSite=Lax`
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
