'server-only'

import { PLATFORM_STRIPE_API_VERSION } from '@/lib/stripe/platform'

/**
 * Connect webhook `data.object` shapes follow the endpoint's pinned API version (or the platform
 * account default). Pin your Connect webhook's `api_version` in the Dashboard (or API) to this
 * value so payloads match `getPlatformStripe()` — see https://docs.stripe.com/webhooks/versioning
 */
export function getExpectedConnectWebhookApiVersion(): string {
  return PLATFORM_STRIPE_API_VERSION
}

type EventWithApiVersion = { api_version?: string | null }

/** Opt out with STRIPE_ENFORCE_WEBHOOK_API_VERSION=false (or 0 / no). Enforced by default. */
function webhookApiVersionEnforcementDisabled(): boolean {
  const v = process.env.STRIPE_ENFORCE_WEBHOOK_API_VERSION?.trim().toLowerCase()
  return v === 'false' || v === '0' || v === 'no'
}

/**
 * Rejects events whose `api_version` does not match the platform pin (unless enforcement is disabled).
 * Configure the Connect webhook endpoint `api_version` in the Dashboard to match `PLATFORM_STRIPE_API_VERSION`.
 */
export function assertConnectWebhookEventApiVersion(event: EventWithApiVersion): void {
  if (webhookApiVersionEnforcementDisabled()) {
    return
  }
  const v = event.api_version
  if (v != null && v !== PLATFORM_STRIPE_API_VERSION) {
    throw new Error(
      `Stripe webhook api_version mismatch: event has "${v}", platform expects "${PLATFORM_STRIPE_API_VERSION}". ` +
        'Set the Connect webhook endpoint api_version in Stripe Dashboard (Developers → Webhooks → endpoint → API version) ' +
        'or set STRIPE_ENFORCE_WEBHOOK_API_VERSION=false to disable enforcement (not recommended in production).',
    )
  }
}

export function warnIfConnectWebhookEventApiVersionMismatch(event: EventWithApiVersion): void {
  if (!webhookApiVersionEnforcementDisabled()) {
    return
  }
  const v = event.api_version
  if (v != null && v !== PLATFORM_STRIPE_API_VERSION) {
    console.warn(
      `[Stripe Connect] Webhook event api_version "${v}" !== platform "${PLATFORM_STRIPE_API_VERSION}". ` +
        'Pin this endpoint’s API version in the Stripe Dashboard to match the app, or re-enable enforcement (default) after fixing.',
    )
  }
}
