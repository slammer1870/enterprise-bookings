/**
 * `pnpm start:e2e` forces this onto the Next server (`STRIPE_CONNECT_WEBHOOK_SECRET`).
 * Playwright loads `apps/atnd-me/.env` first, so the test process otherwise signs with
 * a developer secret the server rejects (HTTP 400).
 */
export const E2E_START_WEBHOOK_SECRET = 'test_webhook_secret'

/**
 * Secret used to sign Stripe webhooks in Playwright.
 * Production e2e (`E2E_USE_PROD` unset or true) talks to `pnpm start:e2e`.
 * `E2E_USE_PROD=false` uses `next dev`, which keeps the developer secret.
 */
export function resolveE2EStripeWebhookSecret(env: NodeJS.ProcessEnv): string {
  if (env.E2E_USE_PROD !== 'false') {
    return E2E_START_WEBHOOK_SECRET
  }
  const secret =
    env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim() || env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret) {
    throw new Error(
      'STRIPE_CONNECT_WEBHOOK_SECRET (or STRIPE_WEBHOOK_SECRET) is required to sign e2e webhooks',
    )
  }
  return secret
}
