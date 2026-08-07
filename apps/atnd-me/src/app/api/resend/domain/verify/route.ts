/**
 * POST /api/resend/domain/verify
 * Body: { tenantId }
 * Triggers Resend domain verification and syncs tenant emailDomainStatus.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import { assertTenantEmailDomainAccess } from '@/lib/resend/assertTenantEmailDomainAccess'
import {
  createOrGetDomain,
  deleteDomain,
  getDomain,
  mapResendStatusToEmailDomainStatus,
  verifyDomain,
} from '@/lib/resend/domains'
import { resolveEmailSendingDomain } from '@/lib/resend/resolveTenantEmailFrom'
import { syncTenantEmailDomainFromResend } from '@/lib/resend/syncTenantEmailDomain'
import { normalizeCustomDomain } from '@/utilities/validateCustomDomain'

export async function POST(request: NextRequest) {
  const payload = await getPayload()

  let body: { tenantId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const tenantIdParam =
    body.tenantId != null ? String(body.tenantId) : request.nextUrl.searchParams.get('tenantId')

  const access = await assertTenantEmailDomainAccess({
    payload,
    headers: request.headers,
    tenantIdParam,
  })
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const tenant = await payload.findByID({
    collection: 'tenants',
    id: access.tenantId,
    depth: 0,
    overrideAccess: true,
    select: {
      domain: true,
      resendDomainId: true,
      emailDomainVerifiedAt: true,
    } as Record<string, boolean>,
  })

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const domainRaw = typeof (tenant as any).domain === 'string' ? (tenant as any).domain : ''
  const websiteDomain = normalizeCustomDomain(domainRaw)
  const emailDomain = resolveEmailSendingDomain(websiteDomain)
  if (!emailDomain) {
    return NextResponse.json({ error: 'Tenant has no custom domain' }, { status: 400 })
  }

  let resendDomainId =
    typeof (tenant as any).resendDomainId === 'string' && (tenant as any).resendDomainId.trim()
      ? String((tenant as any).resendDomainId).trim()
      : null

  if (resendDomainId) {
    const existing = await getDomain(resendDomainId)
    if (existing && existing.name.toLowerCase() !== emailDomain) {
      const created = await createOrGetDomain(emailDomain)
      if (created?.id && created.id !== resendDomainId) {
        await deleteDomain(resendDomainId).catch(() => undefined)
        resendDomainId = created.id
      } else if (created?.id) {
        resendDomainId = created.id
      }
    }
  }

  if (!resendDomainId) {
    const created = await createOrGetDomain(emailDomain)
    resendDomainId = created?.id || null
  }

  if (!resendDomainId) {
    return NextResponse.json({ error: 'Could not provision Resend domain' }, { status: 502 })
  }

  const resendDomain = await verifyDomain(resendDomainId)
  if (!resendDomain) {
    return NextResponse.json({ error: 'Resend verify failed' }, { status: 502 })
  }

  const synced = await syncTenantEmailDomainFromResend({
    payload,
    tenantId: access.tenantId,
    resendDomainId: resendDomain.id,
    resendStatus: resendDomain.status,
  })

  return NextResponse.json({
    domain: emailDomain,
    websiteDomain,
    status: synced.emailDomainStatus,
    resendDomainId: synced.resendDomainId,
    records: resendDomain.records || [],
    verifiedAt:
      synced.emailDomainStatus === 'verified'
        ? (tenant as any).emailDomainVerifiedAt || new Date().toISOString()
        : null,
    mappedFrom: mapResendStatusToEmailDomainStatus(resendDomain.status),
  })
}
