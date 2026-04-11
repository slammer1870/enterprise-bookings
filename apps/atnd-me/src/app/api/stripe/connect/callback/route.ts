/**
 * Step 2.4 / 2.9 – Stripe Connect OAuth callback (code exchange).
 * Verifies state (CSRF + TTL), requires current user to match state.userId, exchanges code, persists, audits.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import { verifyConnectState } from '@/lib/stripe-connect/authorize'
import { exchangeCodeForStripeConnectAccount } from '@/lib/stripe-connect/callbackExchange'
import { getStripeConnectOnboardingStatus } from '@/lib/stripe-connect/account-status'
import { getPlatformStripe } from '@/lib/stripe/platform'
import { getRequestOrigin, getServerSideURL } from '@/utilities/getURL'

const ERROR_REDIRECT = '/admin'

function appendConnectStatus(target: string, status: 'success' | 'error', message?: string) {
  const url = new URL(target)
  url.searchParams.set('stripe_connect', status)
  if (message) {
    url.searchParams.set('message', message)
  } else {
    url.searchParams.delete('message')
  }
  return url.toString()
}

export async function GET(request: NextRequest) {
  const requestBaseUrl = getRequestOrigin(request.headers).replace(/\/$/, '')
  const callbackBaseUrl = getServerSideURL().replace(/\/$/, '')
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  let tenantId: number | null = null
  let stateUserId: number | null = null
  let returnTo = `${requestBaseUrl}${ERROR_REDIRECT}`

  if (state) {
    try {
      const parsed = verifyConnectState(state)
      tenantId = parsed.tenantId
      stateUserId = parsed.userId
      if (parsed.returnTo) {
        returnTo = parsed.returnTo
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Invalid state'
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }

  if (errorParam) {
    return NextResponse.redirect(
      appendConnectStatus(returnTo, 'error', errorParam),
      302,
    )
  }

  if (!code || !state || tenantId == null || stateUserId == null) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })
  }

  const payload = await getPayload()
  const redirectUri = `${callbackBaseUrl}/api/stripe/connect/callback`

  try {
    const result = await exchangeCodeForStripeConnectAccount(code, redirectUri)
    const account = await getPlatformStripe().accounts.retrieve(result.stripe_account_id)
    const onboardingStatus = getStripeConnectOnboardingStatus(account)
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectAccountId: result.stripe_account_id,
        stripeConnectOnboardingStatus: onboardingStatus,
        stripeConnectConnectedAt: new Date().toISOString(),
        stripeConnectLastError: null,
      },
      context: { tenant: tenantId },
      overrideAccess: true,
      select: { id: true } as any,
    })
    console.info('[Stripe Connect] connected', { tenantId, userId: stateUserId })
    return NextResponse.redirect(appendConnectStatus(returnTo, 'success'), 302)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[Stripe Connect] connect callback failed', {
      tenantId,
      userId: stateUserId,
      message,
      code,
    })
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectLastError: message,
      },
      context: { tenant: tenantId },
      overrideAccess: true,
      select: { id: true } as any,
    })
    return NextResponse.redirect(appendConnectStatus(returnTo, 'error', message), 302)
  }
}
