/**
 * GET /api/admin/onboarding-status
 * Returns checklist completion for the current tenant-admin context.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getPayload } from '@/lib/payload'
import {
  buildTenantPublicSiteURL,
  resolveOnboardingTenantId,
  resolveOnboardingUser,
} from '@/lib/onboarding/adminContext'

export async function GET(request: NextRequest) {
  const payload = await getPayload()
  const user = await resolveOnboardingUser(payload, request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = await resolveOnboardingTenantId(payload, user, request)
  if (tenantId == null) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 400 })
  }

  const tenant = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
    select: {
      slug: true,
      domain: true,
      stripeConnectOnboardingStatus: true,
      onboardingSiteViewedAt: true,
    } as any,
  })

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const [eventTypes, schedules] = await Promise.all([
    payload.find({
      collection: 'event-types',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'scheduler',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const userId = user.id != null ? Number(user.id) : null
  const passwordSet = Boolean(
    (user as { onboardingPasswordSetAt?: unknown }).onboardingPasswordSetAt,
  )
  const stripeConnected = tenant.stripeConnectOnboardingStatus === 'active'
  const hasEventType = (eventTypes.totalDocs ?? eventTypes.docs.length) > 0
  const hasSchedule = (schedules.totalDocs ?? schedules.docs.length) > 0
  const siteViewed = Boolean(tenant.onboardingSiteViewedAt)
  const complete =
    passwordSet && stripeConnected && hasEventType && hasSchedule && siteViewed

  const tenantSlug = typeof tenant.slug === 'string' ? tenant.slug : undefined
  const siteURL = buildTenantPublicSiteURL(
    {
      slug: tenantSlug,
      domain: typeof tenant.domain === 'string' ? tenant.domain : null,
    },
    request,
  )

  return NextResponse.json({
    tenantId,
    tenantSlug,
    siteURL,
    userId: Number.isFinite(userId) ? userId : undefined,
    tasks: {
      password: { done: passwordSet },
      stripe: { done: stripeConnected },
      eventType: { done: hasEventType },
      schedule: { done: hasSchedule },
      viewSite: { done: siteViewed },
    },
    complete,
  })
}
