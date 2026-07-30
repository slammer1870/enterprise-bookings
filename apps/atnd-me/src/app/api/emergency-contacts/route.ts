import { NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { resolveTenantIdFromServerContext } from '@/access/tenant-scoped'
import { EMERGENCY_CONTACTS_SLUG } from '@/collections/EmergencyContacts'
import { findEmergencyContactForUser } from '@/lib/emergency-contacts/lookup'
import { normalizePeopleInput } from '@/lib/emergency-contacts/validate-people'
import { verifyEmergencyContactToken } from '@/lib/emergency-contacts/verify-token'

export async function POST(request: Request) {
  try {
    const tenantId = await resolveTenantIdFromServerContext()
    if (tenantId == null) {
      return NextResponse.json({ error: 'No tenant context for this request.' }, { status: 400 })
    }

    const body = (await request.json().catch(() => null)) as {
      token?: unknown
      people?: unknown
    } | null

    const token = typeof body?.token === 'string' ? body.token : ''
    if (!token) {
      return NextResponse.json({ error: 'Verification token is required.' }, { status: 401 })
    }

    let verified: ReturnType<typeof verifyEmergencyContactToken>
    try {
      verified = verifyEmergencyContactToken(token)
    } catch {
      return NextResponse.json(
        { error: 'Verification expired or invalid. Please verify your email again.' },
        { status: 401 },
      )
    }

    if (verified.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Verification does not match this studio.' }, { status: 403 })
    }

    const { people, error } = normalizePeopleInput(body?.people)
    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    const payload = await getPayload()
    const existing = await findEmergencyContactForUser(payload, verified.userId, tenantId)
    const completedAt = existing?.completedAt ?? new Date().toISOString()

    const data = {
      user: verified.userId,
      tenant: tenantId,
      status: 'complete' as const,
      people,
      completedAt,
    }

    if (existing) {
      const updated = await payload.update({
        collection: EMERGENCY_CONTACTS_SLUG,
        id: existing.id,
        data,
        overrideAccess: true,
        depth: 0,
      })
      return NextResponse.json({ ok: true, id: updated.id, status: 'complete' })
    }

    const created = await payload.create({
      collection: EMERGENCY_CONTACTS_SLUG,
      data,
      overrideAccess: true,
      depth: 0,
    })

    return NextResponse.json({ ok: true, id: created.id, status: 'complete' })
  } catch (error) {
    console.error('[emergency-contacts upsert]', error)
    return NextResponse.json({ error: 'Unable to save emergency contacts.' }, { status: 500 })
  }
}
