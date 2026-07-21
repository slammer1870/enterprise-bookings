/**
 * POST /api/admin/onboarding-view-site
 * Marks the "view your page" onboarding step complete and returns the public site URL.
 */
import { NextRequest, NextResponse } from 'next/server'

import { getPayload } from '@/lib/payload'
import {
  buildTenantPublicSiteURL,
  resolveOnboardingTenantId,
  resolveOnboardingUser,
} from '@/lib/onboarding/adminContext'

export async function POST(request: NextRequest) {
  const payload = await getPayload()
  const user = await resolveOnboardingUser(payload, request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let bodyTenantId: number | null = null
  let bodyTenantSlug: string | null = null
  try {
    const body = (await request.json().catch(() => ({}))) as {
      tenantId?: unknown
      tenantSlug?: unknown
    }
    if (typeof body.tenantId === 'number' && Number.isFinite(body.tenantId)) {
      bodyTenantId = body.tenantId
    } else if (typeof body.tenantId === 'string' && /^\d+$/.test(body.tenantId)) {
      bodyTenantId = Number(body.tenantId)
    }
    if (typeof body.tenantSlug === 'string' && body.tenantSlug.trim()) {
      bodyTenantSlug = body.tenantSlug.trim()
    }
  } catch {
    /* ignore */
  }

  const patchedUrl = new URL(request.url)
  if (bodyTenantId != null) {
    patchedUrl.searchParams.set('tenantId', String(bodyTenantId))
  }
  if (bodyTenantSlug) {
    patchedUrl.searchParams.set('tenantSlug', bodyTenantSlug)
  }

  const tenantId = await resolveOnboardingTenantId(
    payload,
    user,
    new NextRequest(patchedUrl, { headers: request.headers }),
  )

  if (tenantId == null) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 400 })
  }

  const tenant = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
    select: { slug: true, domain: true, onboardingSiteViewedAt: true } as any,
  })

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  if (!tenant.onboardingSiteViewedAt) {
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: { onboardingSiteViewedAt: new Date().toISOString() },
      overrideAccess: true,
    })
  }

  const tenantSlug = typeof tenant.slug === 'string' ? tenant.slug : undefined
  if (!tenantSlug) {
    return NextResponse.json({ error: 'Tenant has no slug' }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    tenantId,
    tenantSlug,
    siteURL: buildTenantPublicSiteURL(
      {
        slug: tenantSlug,
        domain: typeof tenant.domain === 'string' ? tenant.domain : null,
      },
      request,
    ),
  })
}
