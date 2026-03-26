/**
 * Step 2.4 / 2.9 – Stripe Connect OAuth callback (code exchange).
 * Verifies state (CSRF + TTL), requires current user to match state.userId, exchanges code, persists, audits.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import { verifyConnectState } from '@/lib/stripe-connect/authorize'
import { exchangeCodeForStripeConnectAccount } from '@/lib/stripe-connect/callbackExchange'
import { getServerSideURL } from '@/utilities/getURL'

const SUCCESS_REDIRECT = '/admin'
const ERROR_REDIRECT = '/admin'

function getCurrentUserId(request: NextRequest): number | null {
  const headers = request.headers
  if (process.env.NODE_ENV === 'test') {
    const testUserId = headers.get('x-test-user-id')
    if (testUserId) return parseInt(testUserId, 10) || null
  }
  return null
}

export async function GET(request: NextRequest) {
  const baseUrl = getServerSideURL().replace(/\/$/, '')
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  if (errorParam) {
    return NextResponse.redirect(
      `${baseUrl}${ERROR_REDIRECT}?stripe_connect=error&message=${encodeURIComponent(errorParam)}`,
      302,
    )
  }

  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })
  }

  let tenantId: number
  let stateUserId: number
  try {
    const parsed = verifyConnectState(state)
    tenantId = parsed.tenantId
    stateUserId = parsed.userId
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid state'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const payload = await getPayload()
  let currentUserId: number | null = getCurrentUserId(request)
  if (currentUserId === null) {
    const authResult = await payload.auth({ headers: request.headers })
    const user = authResult?.user
    currentUserId = user?.id != null ? (user.id as number) : null
  }
  if (currentUserId === null || currentUserId !== stateUserId) {
    return NextResponse.redirect(
      `${baseUrl}${ERROR_REDIRECT}?stripe_connect=error&message=${encodeURIComponent('User mismatch')}`,
      302,
    )
  }

  const redirectUri = `${baseUrl}/api/stripe/connect/callback`

  try {
    const result = await exchangeCodeForStripeConnectAccount(code, redirectUri)
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectAccountId: result.stripe_account_id,
        stripeConnectOnboardingStatus: 'pending',
        stripeConnectConnectedAt: new Date().toISOString(),
        stripeConnectLastError: null,
      },
      overrideAccess: true,
      select: { id: true } as any,
    })
    console.info('[Stripe Connect] connected', { tenantId, userId: stateUserId })
    return NextResponse.redirect(
      `${baseUrl}${SUCCESS_REDIRECT}?stripe_connect=success`,
      302,
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectLastError: message,
      },
      overrideAccess: true,
      select: { id: true } as any,
    })
    return NextResponse.redirect(
      `${baseUrl}${ERROR_REDIRECT}?stripe_connect=error&message=${encodeURIComponent(message)}`,
      302,
    )
  }
}
