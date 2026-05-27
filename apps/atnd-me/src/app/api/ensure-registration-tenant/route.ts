import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { getPayload } from '@/lib/payload'
import { getTenantIdForCreateRequest } from '@/utilities/getTenantContext'
import { cookiesFromHeaders } from '@/utilities/cookiesFromHeaders'

/**
 * Ensures the authenticated user has a registrationTenant assigned.
 *
 * Called from the Better Auth UI provider on session change to catch users who
 * signed up through the Better Auth UI sign-up form when the databaseHooks
 * context did not carry request headers (so the hook silently skipped assignment).
 *
 * Idempotent: returns 200 immediately if the user already has a registrationTenant.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()

    const authResult = await payload.auth({ headers: request.headers })
    const user = authResult?.user as
      | (typeof authResult.user & { registrationTenant?: number | string | null })
      | null
      | undefined

    if (!user?.id) {
      return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 })
    }

    if (user.registrationTenant != null && user.registrationTenant !== '') {
      return NextResponse.json({ ok: true, reason: 'already-set' })
    }

    const cookieStore = await cookies()

    const tenantId = await getTenantIdForCreateRequest(payload, {
      headers: request.headers,
      cookies: cookieStore,
    })

    if (tenantId == null || tenantId === '') {
      return NextResponse.json({ ok: false, reason: 'no-tenant-resolved' })
    }

    await payload.update({
      collection: 'users',
      id: user.id as number,
      data: { registrationTenant: tenantId as number },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true, reason: 'assigned' })
  } catch (err) {
    console.error('[api/ensure-registration-tenant]', err)
    return NextResponse.json({ ok: false, reason: 'error' }, { status: 500 })
  }
}
