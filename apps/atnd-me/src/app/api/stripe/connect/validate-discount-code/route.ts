import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getPayload } from '@/lib/payload'
import { resolveTenantForConnect, resolveTenantSlugOrId } from '@/lib/stripe-connect/api-helpers'
import { resolveTenantDiscountCode } from '@/lib/stripe-connect/discountCodes'

type ValidateDiscountCodeBody = {
  discountCode?: string
  metadata?: Record<string, unknown>
}

function normalizeMetadata(rawMetadata: unknown): Record<string, string> | undefined {
  if (!rawMetadata || typeof rawMetadata !== 'object') {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(rawMetadata as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([key, value]) => [key, value.trim()]),
  )
}

export async function POST(request: NextRequest) {
  const payload = await getPayload()
  const body = (await request.json().catch(() => null)) as ValidateDiscountCodeBody | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const discountCode = typeof body.discountCode === 'string' ? body.discountCode.trim().toUpperCase() : ''
  if (!discountCode) {
    return NextResponse.json({ error: 'discountCode is required' }, { status: 400 })
  }

  const metadataFromBody = normalizeMetadata(body.metadata)
  const tenantIdentifier =
    typeof metadataFromBody?.tenantId === 'string' && metadataFromBody.tenantId.trim().length > 0
      ? metadataFromBody.tenantId
      : resolveTenantSlugOrId(request)

  if (!tenantIdentifier) {
    return NextResponse.json(
      { error: 'Tenant context required (x-tenant-slug / x-tenant-id / tenant-slug cookie / metadata.tenantId)' },
      { status: 400 },
    )
  }

  const tenant = await resolveTenantForConnect(payload, tenantIdentifier)
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found or not stripe-connected' }, { status: 404 })
  }

  const discount = await resolveTenantDiscountCode(payload, tenant.id, discountCode)
  if (!discount) {
    return NextResponse.json({ error: 'Invalid or inactive discount code.' }, { status: 400 })
  }

  return NextResponse.json({
    valid: true,
    discountCode: discount.code,
    discount: {
      type: discount.type,
      value: discount.value,
      currency: discount.currency ?? null,
    },
  })
}
