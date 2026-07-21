/**
 * POST /api/admin/onboarding-set-password
 * Marks the "set a password" onboarding step complete and returns the user edit URL.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getPayload } from '@/lib/payload'
import { resolveOnboardingUser } from '@/lib/onboarding/adminContext'

export async function POST(request: NextRequest) {
  const payload = await getPayload()
  const user = await resolveOnboardingUser(payload, request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = user.id != null ? Number(user.id) : NaN
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: 'Invalid user' }, { status: 400 })
  }

  if (!(user as { onboardingPasswordSetAt?: unknown }).onboardingPasswordSetAt) {
    await payload.update({
      collection: 'users',
      id: userId,
      data: { onboardingPasswordSetAt: new Date().toISOString() },
      overrideAccess: true,
    })
  }

  return NextResponse.json({
    ok: true,
    editUserURL: `/admin/collections/users/${userId}`,
  })
}
