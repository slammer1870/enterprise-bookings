'server-only'

import type { Payload } from 'payload'
import { getPlatformStripe } from '@/lib/stripe/platform'
import type Stripe from 'stripe'
import {
  getTenantPlatformSubdomain,
  readHostnameDeclaration,
  type TenantPublicHostDocSlice,
} from '@/utilities/tenantPublicHostDeclaration'

export type ApplePayTenantDocSlice = TenantPublicHostDocSlice & {
  stripeConnectAccountId?: unknown
}

/**
 * Serving hosts to register on the platform account. An alias host is absent.
 * With no custom hostname, the platform subdomain is the only Apple Pay domain.
 */
export function applePayDomainsForDeclaration(
  doc: TenantPublicHostDocSlice | null | undefined,
): string[] {
  if (!doc) return []
  return readHostnameDeclaration(doc).roles.servingHosts
}

/**
 * Domains that must exist on the connected account.
 *
 * Checkout initialises Elements with `loadStripe(key, { stripeAccount })` and creates
 * direct charges, so Apple Pay is validated against this account — not the platform.
 * The platform subdomain is always included: it is the only serving host when no custom
 * hostname is named, and admin (and any leftover public traffic) still uses it after a
 * custom hostname is named.
 */
export function applePayDomainsForConnectedAccount(
  doc: TenantPublicHostDocSlice | null | undefined,
): string[] {
  const serving = applePayDomainsForDeclaration(doc)
  const slug = typeof doc?.slug === 'string' ? doc.slug : ''
  const platformHost = getTenantPlatformSubdomain(slug)
  if (!platformHost || serving.includes(platformHost)) return serving
  return [...serving, platformHost]
}

function uniqueHosts(hosts: string[]): string[] {
  return [...new Set(hosts.filter((host) => host.trim().length > 0))]
}

function connectedAccountIdOf(doc: ApplePayTenantDocSlice | null | undefined): string | null {
  if (typeof doc?.stripeConnectAccountId !== 'string') return null
  const id = doc.stripeConnectAccountId.trim()
  return id || null
}

export type ApplePayRegistrationPlan = {
  platform: string[]
  connected: string[]
}

/**
 * Which payment-method domains to create/enable after a tenant save.
 * Platform account follows serving hosts. Connected account always also gets the
 * platform subdomain, and is synced when Stripe Connect is first attached.
 */
export function applePayRegistrationPlan(args: {
  doc: ApplePayTenantDocSlice
  previousDoc?: ApplePayTenantDocSlice | null
  operation: 'create' | 'update'
}): ApplePayRegistrationPlan {
  const { doc, previousDoc, operation } = args
  const serving = uniqueHosts(applePayDomainsForDeclaration(doc))
  const previousServing =
    operation === 'create' || !previousDoc
      ? []
      : uniqueHosts(applePayDomainsForDeclaration(previousDoc))
  const previousServingSet = new Set(previousServing)
  const servingChanged =
    operation === 'create' ||
    serving.length !== previousServingSet.size ||
    serving.some((host) => !previousServingSet.has(host))

  const connectedAccountId = connectedAccountIdOf(doc)
  const previousConnectedAccountId = connectedAccountIdOf(previousDoc ?? null)
  const connectedAccountChanged =
    Boolean(connectedAccountId) &&
    (operation === 'create' || previousConnectedAccountId !== connectedAccountId)

  const platform: string[] = []
  if (servingChanged) {
    for (const host of serving) {
      if (operation === 'create' || !previousServingSet.has(host)) {
        platform.push(host)
      }
    }
  }

  const connected: string[] = []
  if (connectedAccountId && (servingChanged || connectedAccountChanged)) {
    connected.push(...uniqueHosts(applePayDomainsForConnectedAccount(doc)))
  }

  return { platform, connected }
}

type PaymentMethodDomainsApi = {
  list?: (...args: any[]) => Promise<any>
  create?: (...args: any[]) => Promise<any>
  update?: (...args: any[]) => Promise<any>
  validate?: (...args: any[]) => Promise<any>
}

function applePayIsActive(record: { apple_pay?: { status?: string } | null } | null | undefined): boolean {
  return record?.apple_pay?.status === 'active'
}

async function ensureApplePayActive(
  paymentMethodDomains: PaymentMethodDomainsApi,
  record: { id?: string; apple_pay?: { status?: string } | null },
  domain: string,
  accountLabel: string,
  requestOptions: Stripe.RequestOptions | undefined,
): Promise<void> {
  if (applePayIsActive(record) || !record?.id) return
  if (!paymentMethodDomains.validate) {
    console.warn(
      `[registerApplePayDomain] Stripe paymentMethodDomains.validate is not available — Apple Pay may stay inactive on "${domain}"${accountLabel}`,
    )
    return
  }
  await paymentMethodDomains.validate(record.id, requestOptions)
  console.log(`[registerApplePayDomain] Validated "${domain}"${accountLabel} for Apple Pay`)
}

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
 *  2. Found + enabled  → re-validate Apple Pay if it is still inactive; otherwise no-op.
 *  3. Found + disabled → re-enable, then validate if needed.
 *  4. Not found        → create, then validate if Apple Pay is inactive.
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
  const paymentMethodDomains = (stripe as any).paymentMethodDomains as PaymentMethodDomainsApi | undefined
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
      if (applePayIsActive(record)) {
        console.log(`[registerApplePayDomain] "${domain}"${accountLabel} already registered and enabled — skipping`)
        return
      }
      await ensureApplePayActive(paymentMethodDomains, record, domain, accountLabel, requestOptions)
      return
    }
    if (!paymentMethodDomains.update) {
      console.warn(
        `[registerApplePayDomain] Stripe paymentMethodDomains.update is not available — skipping re-enable "${domain}"`,
      )
      return
    }
    const updated = await paymentMethodDomains.update(record.id, { enabled: true }, requestOptions)
    console.log(`[registerApplePayDomain] Re-enabled "${domain}"${accountLabel}`)
    await ensureApplePayActive(
      paymentMethodDomains,
      updated ?? record,
      domain,
      accountLabel,
      requestOptions,
    )
    return
  }

  if (!paymentMethodDomains.create) {
    console.warn(
      `[registerApplePayDomain] Stripe paymentMethodDomains.create is not available — skipping register "${domain}"`,
    )
    return
  }
  const created = await paymentMethodDomains.create({ domain_name: domain }, requestOptions)
  console.log(`[registerApplePayDomain] Registered "${domain}"${accountLabel}`)
  await ensureApplePayActive(paymentMethodDomains, created ?? {}, domain, accountLabel, requestOptions)
}

/**
 * Registers this tenant's serving hosts plus the platform subdomain on a connected Stripe account.
 * Call this after OAuth onboarding so Apple Pay is available without waiting for the next save.
 */
export async function registerAllDomainsForConnectedAccount(
  payload: Payload,
  connectedAccountId: string,
  tenantId: number,
): Promise<void> {
  const tenant = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
    select: { slug: true, hostnames: true, direction: true } as Record<string, boolean>,
  })

  const tenantDoc = tenant as TenantPublicHostDocSlice
  const domains = uniqueHosts(applePayDomainsForConnectedAccount(tenantDoc))

  for (const domain of domains) {
    await registerApplePayDomain(domain, connectedAccountId).catch((err: unknown) => {
      console.error(
        `[registerAllDomainsForConnectedAccount] Failed "${domain}" (${connectedAccountId}):`,
        err,
      )
    })
  }
}
