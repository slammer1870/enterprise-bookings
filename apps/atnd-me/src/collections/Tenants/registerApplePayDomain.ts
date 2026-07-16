'server-only'

import type { Payload } from 'payload'
import { getPlatformStripe } from '@/lib/stripe/platform'
import type Stripe from 'stripe'

/**
 * Ensures a domain is registered and enabled in Stripe's paymentMethodDomains.
 *
 * Must be called twice per domain — once for the platform account, and once for the
 * tenant's connected account — because Stripe Elements is initialised with
 * `loadStripe(key, { stripeAccount })`, so Apple Pay validation happens against the
 * connected account's domain list, not the platform's.
 *
 * For destination charges, register on the platform by omitting `stripeAccountId`.
 * For the connected account, pass `stripeAccountId`.
 *
 * Strategy:
 *  1. List existing registrations filtered to this domain_name.
 *  2. Found + enabled  → no-op.
 *  3. Found + disabled → re-enable.
 *  4. Not found        → create.
 */
export async function registerApplePayDomain(
  domain: string,
  stripeAccountId?: string,
): Promise<void> {
  // E2E/int environments should not depend on live Stripe domain registration.
  // Stripe calls can hang/fail (e.g. DNS/ENOTFOUND) and block request/route rendering,
  // which in turn causes Playwright timeouts. Int tests also create many fake Connect
  // accounts; calling paymentMethodDomains against them burns CI time/heap.
  // (Do not key off NODE_ENV=test — unit tests mock Stripe and need this path.)
  if (
    process.env.SKIP_APPLE_PAY_DOMAIN_REGISTRATION === 'true' ||
    process.env.ENABLE_TEST_WEBHOOKS === 'true' ||
    process.env.PW_E2E_PROFILE
  ) {
    return
  }

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    console.warn('[registerApplePayDomain] STRIPE_SECRET_KEY not set — skipping domain registration')
    return
  }

  const stripe = getPlatformStripe()
  if (!stripe) {
    console.warn('[registerApplePayDomain] Stripe client not available — skipping domain registration')
    return
  }
  // Stripe's API surface can vary by API version / account type; in some E2E/test
  // environments the SDK might not expose paymentMethodDomains at all.
  const paymentMethodDomains = (stripe as any).paymentMethodDomains as
    | {
        list?: (...args: any[]) => Promise<any>
        create?: (...args: any[]) => Promise<any>
        update?: (...args: any[]) => Promise<any>
      }
    | undefined
  const requestOptions: Stripe.RequestOptions | undefined = stripeAccountId
    ? { stripeAccount: stripeAccountId }
    : undefined

  if (!paymentMethodDomains?.list) {
    console.warn(
      `[registerApplePayDomain] Stripe paymentMethodDomains.list is not available — skipping "${domain}"`,
    )
    return
  }

  const existing = await paymentMethodDomains.list({ domain_name: domain, limit: 1 }, requestOptions)
  const record = existing?.data?.[0]
  const accountLabel = stripeAccountId ? ` (${stripeAccountId})` : ' (platform)'

  if (record) {
    if (record.enabled) {
      console.log(`[registerApplePayDomain] "${domain}"${accountLabel} already registered and enabled — skipping`)
      return
    }
    if (!paymentMethodDomains.update) {
      console.warn(
        `[registerApplePayDomain] Stripe paymentMethodDomains.update is not available — skipping re-enable "${domain}"`,
      )
      return
    }
    await paymentMethodDomains.update(record.id, { enabled: true }, requestOptions)
    console.log(`[registerApplePayDomain] Re-enabled "${domain}"${accountLabel}`)
    return
  }

  if (!paymentMethodDomains.create) {
    console.warn(
      `[registerApplePayDomain] Stripe paymentMethodDomains.create is not available — skipping register "${domain}"`,
    )
    return
  }
  await paymentMethodDomains.create({ domain_name: domain }, requestOptions)
  console.log(`[registerApplePayDomain] Registered "${domain}"${accountLabel}`)
}

/**
 * Registers all platform domains (platform subdomains + custom domain) for a specific tenant
 * on a connected Stripe account. Call this after a tenant completes OAuth onboarding so Apple
 * Pay is immediately available without waiting for the next domain change.
 */
export async function registerAllDomainsForConnectedAccount(
  payload: Payload,
  connectedAccountId: string,
  tenantId: number,
): Promise<void> {
  const rootHostname = (() => {
    const url = process.env.NEXT_PUBLIC_SERVER_URL
    if (!url) return null
    try { return new URL(url).hostname.toLowerCase() } catch { return null }
  })()

  const tenant = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
    select: { slug: true, domain: true } as Record<string, boolean>,
  })

  const tenantDoc = tenant as { slug?: string | null; domain?: string | null }
  const slug = typeof tenantDoc.slug === 'string' ? tenantDoc.slug.trim() : null
  const customDomain = typeof tenantDoc.domain === 'string' ? tenantDoc.domain.trim() : null

  const domains: string[] = []
  if (slug && rootHostname) domains.push(`${slug}.${rootHostname}`)
  if (customDomain) domains.push(customDomain)

  for (const domain of domains) {
    await registerApplePayDomain(domain, connectedAccountId).catch((err: unknown) => {
      console.error(
        `[registerAllDomainsForConnectedAccount] Failed "${domain}" (${connectedAccountId}):`,
        err,
      )
    })
  }
}
