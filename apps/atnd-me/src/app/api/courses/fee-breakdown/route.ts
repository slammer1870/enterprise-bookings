import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getPayload } from '@/lib/payload'
import { calculateBookingFeeAmount } from '@/lib/stripe-connect/bookingFee'
import {
  resolveTenantSlugOrId,
  resolveTenantForConnect,
} from '@/lib/stripe-connect/api-helpers'

export const dynamic = 'force-dynamic'

/**
 * Public fee breakdown for course enroll panel (no auth required).
 * Uses the same platform-fees path as course PaymentIntents (productType: course).
 */
export async function POST(request: NextRequest) {
  const payload = await getPayload()
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const courseId =
    typeof body.courseId === 'number'
      ? body.courseId
      : typeof body.courseId === 'string' && /^\d+$/.test(body.courseId)
        ? parseInt(body.courseId, 10)
        : null
  const classPriceCents =
    typeof body.classPriceCents === 'number' ? body.classPriceCents : null

  if (courseId == null || classPriceCents == null || classPriceCents < 0) {
    return NextResponse.json(
      { error: 'courseId and classPriceCents are required' },
      { status: 400 },
    )
  }

  const course = (await payload
    .findByID({
      collection: 'courses' as import('payload').CollectionSlug,
      id: courseId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)) as {
    tenant?: number | { id: number }
    status?: string | null
  } | null

  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  const tenantId =
    course.tenant != null
      ? typeof course.tenant === 'object'
        ? course.tenant.id
        : course.tenant
      : null

  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 400 })
  }

  const requestTenantSlugOrId = resolveTenantSlugOrId(request)
  if (requestTenantSlugOrId != null) {
    const requestNumericId = /^\d+$/.test(requestTenantSlugOrId)
      ? parseInt(requestTenantSlugOrId, 10)
      : null
    if (requestNumericId != null) {
      if (requestNumericId !== tenantId) {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 })
      }
    } else {
      const requestTenant = await resolveTenantForConnect(payload, requestTenantSlugOrId)
      if (requestTenant != null && requestTenant.id !== tenantId) {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 })
      }
    }
  }

  const bookingFeeCents = await calculateBookingFeeAmount({
    tenantId,
    productType: 'course',
    classPriceAmount: classPriceCents,
    payload,
  })

  return NextResponse.json({
    classPriceCents,
    bookingFeeCents,
    totalCents: classPriceCents + bookingFeeCents,
  })
}
