/**
 * Step 2.6 – Stripe Connect status for admin UX.
 * GET returns { connected, tenantSlug } for the current user's tenant (tenant-admin only).
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { getUserTenantIds } from '@/access/tenant-scoped'

export async function GET(request: NextRequest) {
  const payload = await getPayload()
  const authResult = await payload.auth({ headers: request.headers })
  const user = (authResult?.user as SharedUser) ?? null

  if (!user || !checkRole(['admin', 'tenant-admin'], user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantIds = getUserTenantIds(user)
  if (tenantIds === null || tenantIds.length === 0) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 400 })
  }

  const tenantId = tenantIds[0] as number
  const result = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })
  if (!result) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const slug = typeof result.slug === 'string' ? result.slug : undefined
  const status = result.stripeConnectOnboardingStatus as string | undefined
  const connected = status === 'active'

  return NextResponse.json({ connected, tenantSlug: slug })
}
