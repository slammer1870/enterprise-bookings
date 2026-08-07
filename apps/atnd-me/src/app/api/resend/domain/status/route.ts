/**
 * GET /api/resend/domain/status?tenantId=
 * Returns Resend DNS records + verification status for the tenant's custom domain.
 * Ensures a Resend domain exists when missing; syncs tenant emailDomainStatus fields.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import { assertTenantEmailDomainAccess } from '@/lib/resend/assertTenantEmailDomainAccess'
import { createOrGetDomain, deleteDomain, getDomain, mapResendStatusToEmailDomainStatus } from '@/lib/resend/domains'
import { resolveEmailSendingDomain } from '@/lib/resend/resolveTenantEmailFrom'
import { syncTenantEmailDomainFromResend } from '@/lib/resend/syncTenantEmailDomain'
import { normalizeCustomDomain } from '@/utilities/validateCustomDomain'

export async function GET(request: NextRequest) {
  const payload = await getPayload()
  const tenantIdParam = request.nextUrl.searchParams.get('tenantId')
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
      emailDomainStatus: true,
      emailDomainVerifiedAt: true,
      name: true,
    } as Record<string, boolean>,
  })

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const domainRaw = typeof (tenant as any).domain === 'string' ? (tenant as any).domain : ''
  const websiteDomain = normalizeCustomDomain(domainRaw)
  const emailDomain = resolveEmailSendingDomain(websiteDomain)
  if (!emailDomain) {
    return NextResponse.json({
      domain: null,
      websiteDomain: websiteDomain || null,
      status: 'not_configured',
      resendDomainId: null,
      records: [],
      verifiedAt: null,
    })
  }

  let resendDomainId =
    typeof (tenant as any).resendDomainId === 'string' && (tenant as any).resendDomainId.trim()
      ? String((tenant as any).resendDomainId).trim()
      : null

  let resendDomain = resendDomainId ? await getDomain(resendDomainId) : null
  // Migrate away from a wrongly provisioned www.* Resend domain.
  if (resendDomain && resendDomain.name.toLowerCase() !== emailDomain) {
    const oldId = resendDomain.id
    resendDomain = await createOrGetDomain(emailDomain)
    if (resendDomain && oldId !== resendDomain.id) {
      await deleteDomain(oldId).catch(() => undefined)
    }
    resendDomainId = resendDomain?.id || null
  }
  if (!resendDomain) {
    resendDomain = await createOrGetDomain(emailDomain)
    resendDomainId = resendDomain?.id || null
  }

  if (resendDomain) {
    await syncTenantEmailDomainFromResend({
      payload,
      tenantId: access.tenantId,
      resendDomainId: resendDomain.id,
      resendStatus: resendDomain.status,
    })
  }

  const status = resendDomain
    ? mapResendStatusToEmailDomainStatus(resendDomain.status)
    : 'failed'

  return NextResponse.json({
    domain: emailDomain,
    websiteDomain,
    status,
    resendDomainId: resendDomain?.id || null,
    records: resendDomain?.records || [],
    verifiedAt: status === 'verified' ? (tenant as any).emailDomainVerifiedAt || new Date().toISOString() : null,
  })
}
