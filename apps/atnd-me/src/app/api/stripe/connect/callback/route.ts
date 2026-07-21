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
import { registerAllDomainsForConnectedAccount } from '@/collections/Tenants/registerApplePayDomain'

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
    const accountId = result.stripe_account_id?.trim()
    if (!accountId) {
      throw new Error('Stripe response missing account id')
    }

    // stripeConnectAccountId is unique — surface a clear error instead of Payload's
    // generic "The following field is invalid: stripeConnectAccountId".
    const existing = await payload.find({
      collection: 'tenants',
      where: {
        and: [
          { stripeConnectAccountId: { equals: accountId } },
          { id: { not_equals: tenantId } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      select: { id: true, name: true, slug: true } as any,
    })
    if (existing.docs.length > 0) {
      const other = existing.docs[0] as { slug?: string | null; name?: string | null }
      const label = other.slug || other.name || `#${(existing.docs[0] as { id: number }).id}`
      throw new Error(
        `This Stripe account is already connected to another workspace (${label}). Disconnect it there first, or connect a different Stripe account.`,
      )
    }

    const account = await getPlatformStripe().accounts.retrieve(accountId)
    const onboardingStatus = getStripeConnectOnboardingStatus(account)
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectAccountId: accountId,
        stripeConnectOnboardingStatus: onboardingStatus,
        stripeConnectConnectedAt: new Date().toISOString(),
        stripeConnectLastError: null,
      },
      context: { tenant: tenantId },
      overrideAccess: true,
      select: { id: true } as any,
    })
    console.info('[Stripe Connect] connected', { tenantId, userId: stateUserId })

    // Register all platform domains on the newly connected account so Apple Pay
    // works immediately — Elements is initialised with { stripeAccount } so Stripe
    // checks the connected account's domain list, not the platform's.
    registerAllDomainsForConnectedAccount(
      payload,
      accountId,
      tenantId,
    ).catch((err) => {
      console.error('[Stripe Connect] Apple Pay domain registration failed for connected account', {
        tenantId,
        accountId,
        err,
      })
    })

    return NextResponse.redirect(appendConnectStatus(returnTo, 'success'), 302)
  } catch (e) {
    let message = e instanceof Error ? e.message : String(e)
    // Fallback if a race still hits the DB unique constraint.
    if (/stripeConnectAccountId/i.test(message) && /invalid/i.test(message)) {
      message =
        'This Stripe account is already connected to another workspace. Disconnect it there first, or connect a different Stripe account.'
    }
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
