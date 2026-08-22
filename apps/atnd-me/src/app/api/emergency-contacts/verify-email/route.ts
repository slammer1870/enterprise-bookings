import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { resolveTenantIdFromServerContext } from '@/access/tenant-scoped'
import { buildAuthCallbackURL, sanitizeRedirectPath } from '@/lib/emergency-contacts/auth-redirect'
import {
  findEmergencyContactForUser,
  findTenantUserByEmail,
  hasEmergencyContactOnFile,
} from '@/lib/emergency-contacts/lookup'
import { buildEmergencyContactVerifyToken } from '@/lib/emergency-contacts/verify-token'
import { getTenantContext } from '@/utilities/getTenantContext'

export async function POST(request: Request) {
  try {
    const tenantId = await resolveTenantIdFromServerContext()
    if (tenantId == null) {
      return NextResponse.json({ error: 'No tenant context for this request.' }, { status: 400 })
    }

    const body = (await request.json().catch(() => null)) as {
      email?: unknown
      redirectTo?: unknown
    } | null
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
      if (!payload.betterAuth?.api?.signInMagicLink) {
        return NextResponse.json({ error: 'Auth is not configured.' }, { status: 500 })
      }

      const requestHeaders = await headers()
      const tenant = await getTenantContext(payload, { headers: requestHeaders })
      const redirectTo = sanitizeRedirectPath(body?.redirectTo)
      const callbackURL = buildAuthCallbackURL({
        redirectTo,
        tenant,
        headers: requestHeaders,
        serverUrlFallback: process.env.NEXT_PUBLIC_SERVER_URL || process.env.SERVER_URL,
      })

      await payload.betterAuth.api.signInMagicLink({
        body: {
          email: user.email,
          callbackURL,
        },
        headers: requestHeaders,
      })

      return NextResponse.json({
        requiresAuth: true,
        magicLinkSent: true,
      })
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
