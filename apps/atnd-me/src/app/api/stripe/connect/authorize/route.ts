/**
 * Stripe Connect OAuth initiation (redirect-only).
 * Requires auth (tenant-admin or admin), tenant context, builds redirect to Stripe.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import { buildStripeConnectAuthorizeUrl } from '@/lib/stripe-connect/authorize'
import { getServerSideURL } from '@/utilities/getURL'
import {
  getCurrentUser,
  resolveTenantSlugOrId,
  resolveTenantForConnect,
  userHasStripeConnectAccess,
} from '@/lib/stripe-connect/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    const user = await getCurrentUser(payload, request)

    if (!user || !userHasStripeConnectAccess(user, ['admin', 'tenant-admin'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const slugOrId = resolveTenantSlugOrId(request)
    if (!slugOrId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 })
    }

    const tenant = await resolveTenantForConnect(payload, slugOrId)
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 })
    }

    if (!userHasStripeConnectAccess(user, ['admin', 'tenant-admin'], tenant.id)) {
      return NextResponse.json({ error: 'Forbidden: tenant not accessible' }, { status: 403 })
    }

    const baseUrl = getServerSideURL().replace(/\/$/, '')
    const { url } = buildStripeConnectAuthorizeUrl(tenant.id, user.id as number, baseUrl)
    return NextResponse.redirect(url, 302)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe Connect authorize failed'
    if (
      message.includes('STRIPE_') ||
      message.includes('Stripe Connect') ||
      message.includes('required for Stripe')
    ) {
      const missingVar =
        message.includes('STRIPE_SECRET_KEY') ? 'STRIPE_SECRET_KEY' :
        message.includes('STRIPE_CONNECT_CLIENT_ID') ? 'STRIPE_CONNECT_CLIENT_ID' :
        message.includes('STRIPE_CONNECT_WEBHOOK_SECRET') ? 'STRIPE_CONNECT_WEBHOOK_SECRET' :
        null
      return NextResponse.json(
        {
          error: 'Stripe Connect is not configured',
          hint: missingVar ? `Ensure ${missingVar} is set in this environment.` : undefined,
          details: process.env.NODE_ENV === 'development' ? message : undefined,
        },
        { status: 503 }
      )
    }
    if (process.env.NODE_ENV === 'development') {
      console.error('[stripe/connect/authorize]', err)
      return NextResponse.json({ error: 'Authorize failed', details: message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Authorize failed' }, { status: 500 })
  }
}
