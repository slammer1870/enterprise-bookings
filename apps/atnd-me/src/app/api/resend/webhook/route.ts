/**
 * Resend domain webhooks: domain.updated, domain.created, domain.deleted,
 * and forward-compat domain.verified.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import {
  findTenantIdByResendDomainId,
  syncTenantEmailDomainFromResend,
} from '@/lib/resend/syncTenantEmailDomain'
import { verifyResendWebhook } from '@/lib/resend/webhookVerify'

export async function POST(request: NextRequest) {
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  let event
  try {
    event = verifyResendWebhook(rawBody, {
      id: request.headers.get('svix-id'),
      timestamp: request.headers.get('svix-timestamp'),
      signature: request.headers.get('svix-signature'),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const type = typeof event?.type === 'string' ? event.type : ''
  const data = event?.data && typeof event.data === 'object' ? event.data : {}
  const resendDomainId = typeof data.id === 'string' ? data.id : null

  if (!resendDomainId) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'missing domain id' })
  }

  const domainEvents = new Set([
    'domain.updated',
    'domain.created',
    'domain.deleted',
    'domain.verified',
  ])
  if (!domainEvents.has(type)) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'unhandled event type' })
  }

  const payload = await getPayload()
  const tenantId = await findTenantIdByResendDomainId(payload, resendDomainId)
  if (tenantId == null) {
    // Domain may not be linked yet (race with afterChange) — acknowledge so Resend doesn't retry forever.
    return NextResponse.json({ ok: true, ignored: true, reason: 'no matching tenant' })
  }

  if (type === 'domain.deleted') {
    await syncTenantEmailDomainFromResend({
      payload,
      tenantId,
      clear: true,
    })
    return NextResponse.json({ ok: true, cleared: true, tenantId })
  }

  const resendStatus =
    type === 'domain.verified'
      ? 'verified'
      : typeof data.status === 'string'
        ? data.status
        : 'pending'

  const synced = await syncTenantEmailDomainFromResend({
    payload,
    tenantId,
    resendDomainId,
    resendStatus,
  })

  return NextResponse.json({
    ok: true,
    tenantId,
    status: synced.emailDomainStatus,
  })
}
