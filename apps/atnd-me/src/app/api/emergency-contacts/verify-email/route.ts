import { NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { resolveTenantIdFromServerContext } from '@/access/tenant-scoped'
import {
  findEmergencyContactForUser,
  findTenantUserByEmail,
  hasEmergencyContactOnFile,
} from '@/lib/emergency-contacts/lookup'
import { buildEmergencyContactVerifyToken } from '@/lib/emergency-contacts/verify-token'

export async function POST(request: Request) {
  try {
    const tenantId = await resolveTenantIdFromServerContext()
    if (tenantId == null) {
      return NextResponse.json({ error: 'No tenant context for this request.' }, { status: 400 })
    }

    const body = (await request.json().catch(() => null)) as { email?: unknown } | null
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }

    const payload = await getPayload()
    const user = await findTenantUserByEmail(payload, email, tenantId)
    if (!user) {
      return NextResponse.json(
        { error: 'No account found for that email at this studio.' },
        { status: 404 },
      )
    }

    const existing = await findEmergencyContactForUser(payload, user.id, tenantId)
    if (hasEmergencyContactOnFile(existing)) {
      return NextResponse.json(
        {
          error:
            'Emergency contacts are already on file for this account. Sign in to view or update them.',
          requiresAuth: true,
        },
        { status: 403 },
      )
    }

    const token = buildEmergencyContactVerifyToken(user.id, tenantId, user.email)

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      existing: null,
    })
  } catch (error) {
    console.error('[emergency-contacts/verify-email]', error)
    return NextResponse.json({ error: 'Unable to verify email.' }, { status: 500 })
  }
}
