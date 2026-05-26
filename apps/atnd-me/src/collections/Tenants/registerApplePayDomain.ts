'server-only'

import { getPlatformStripe } from '@/lib/stripe/platform'

/**
 * Ensures a domain is registered and enabled in Stripe's paymentMethodDomains, which activates
 * Apple Pay, Google Pay, Link, and other wallet methods for Elements on that domain.
 *
 * Stripe handles all Apple merchant validation internally — no `.well-known` file required.
 *
 * For destination charges (this platform's charge type), registration only needs to happen on
 * the platform account. Direct charges would require per-connected-account registration.
 *
 * Strategy:
 *  1. List existing registrations filtered to this domain_name.
 *  2. If found and enabled → no-op.
 *  3. If found but disabled → re-enable it.
 *  4. If not found → create it.
 */
export async function registerApplePayDomain(domain: string): Promise<void> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    console.warn('[registerApplePayDomain] STRIPE_SECRET_KEY not set — skipping domain registration')
    return
  }

  const stripe = getPlatformStripe()

  const existing = await stripe.paymentMethodDomains.list({ domain_name: domain, limit: 1 })
  const record = existing.data[0]

  if (record) {
    if (record.enabled) {
      console.log(`[registerApplePayDomain] "${domain}" already registered and enabled — skipping`)
      return
    }
    // Re-enable a previously disabled registration.
    await stripe.paymentMethodDomains.update(record.id, { enabled: true })
    console.log(`[registerApplePayDomain] Re-enabled "${domain}"`)
    return
  }

  await stripe.paymentMethodDomains.create({ domain_name: domain })
  console.log(`[registerApplePayDomain] Registered "${domain}" with Stripe`)
}
