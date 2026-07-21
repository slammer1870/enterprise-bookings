import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getPayload } from '@/lib/payload'
import { checkRateLimit } from '@/lib/onboarding/rateLimit'
import { normalizeAndValidateTenantSlug } from '@/lib/onboarding/slug'

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip') || 'unknown'
}

export async function GET(request: NextRequest) {
  const ip = clientIp(request)
  const limit = checkRateLimit({ key: `slug-available:ip:${ip}`, limit: 60, windowMs: 60 * 1000 })
  if (!limit.allowed) {
    return NextResponse.json(
      { available: false, error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000) || 60) },
      },
    )
  }

  const rawSlug = request.nextUrl.searchParams.get('slug')
  const validated = normalizeAndValidateTenantSlug(rawSlug)
  if (!validated.ok) {
    return NextResponse.json({ available: false, error: validated.error })
  }

  const payload = await getPayload()
  const existing = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: validated.slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  return NextResponse.json({
    available: !existing.docs[0],
    slug: validated.slug,
  })
}
