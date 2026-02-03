/**
 * Step 2.3 – Stripe Connect OAuth initiation (redirect-only).
 * Requires auth (tenant-admin or admin), tenant context, and builds redirect to Stripe.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { getUserTenantIds } from '@/access/tenant-scoped'
import { buildStripeConnectAuthorizeUrl } from '@/lib/stripe-connect/authorize'

export async function GET(request: NextRequest) {
  const payload = await getPayload()
  const headers = request.headers

  let user: SharedUser | null = null
  if (process.env.NODE_ENV === 'test') {
    const testUserId = headers.get('x-test-user-id')
    if (testUserId) {
      const u = await payload.findByID({
        collection: 'users',
        id: parseInt(testUserId, 10),
        overrideAccess: true,
      })
      user = u as unknown as SharedUser
    }
  }
  if (!user) {
    const authResult = await payload.auth({ headers })
    user = (authResult?.user as SharedUser) ?? null
  }

  if (!user || !checkRole(['admin', 'tenant-admin'], user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let tenant: { id: number } | null = null
  if (process.env.NODE_ENV === 'test') {
    const testTenantId = headers.get('x-tenant-id')
    if (testTenantId) {
      const t = await payload.findByID({
        collection: 'tenants',
        id: parseInt(testTenantId, 10),
        overrideAccess: true,
      })
      tenant = t ? { id: t.id as number } : null
    }
  }
  if (!tenant) {
    const slug =
      headers.get('x-tenant-slug') ??
      request.cookies.get('tenant-slug')?.value ??
      request.nextUrl.searchParams.get('tenantSlug')
    if (!slug) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 })
    }
    const result = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const t = result.docs[0]
    tenant = t ? { id: t.id as number } : null
  }

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 400 })
  }

  const tenantIds = getUserTenantIds(user)
  if (tenantIds !== null && !tenantIds.includes(tenant.id)) {
    return NextResponse.json({ error: 'Forbidden: tenant not accessible' }, { status: 403 })
  }

  const baseUrl = request.nextUrl.origin
  const { url } = buildStripeConnectAuthorizeUrl(tenant.id, user.id as number, baseUrl)
  return NextResponse.redirect(url, 302)
}
