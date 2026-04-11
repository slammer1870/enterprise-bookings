/**
 * Returns the current admin tenant selection (payload-tenant cookie) for sidebar display.
 * Used so the dashboard view can show the same "selected tenant [X]" in the sidebar as other collections.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import { getCurrentUser } from '@/lib/stripe-connect/api-helpers'
import { checkRole } from '@repo/shared-utils'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    const user = await getCurrentUser(payload, request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!checkRole(['super-admin', 'admin', 'staff'], user as Parameters<typeof checkRole>[1])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const payloadTenant = request.cookies.get('payload-tenant')?.value
    if (!payloadTenant || !/^\d+$/.test(payloadTenant)) {
      return NextResponse.json({ tenantId: null, tenantName: null })
    }

    const tenantId = parseInt(payloadTenant, 10)
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
      select: { name: true },
    }).catch(() => null)

    const tenantName = tenant ? (tenant as { name?: string }).name ?? null : null
    return NextResponse.json({ tenantId, tenantName })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get current tenant'
    if (process.env.NODE_ENV === 'development') {
      console.error('[api/admin/current-tenant]', err)
      return NextResponse.json({ error: message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Failed to get current tenant' }, { status: 500 })
  }
}
