import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Step 2.0 – Stripe Connect prerequisites (configuration scaffolding)
 * Tests must pass without touching the network.
 *
 * - Fails if required Stripe env vars are missing in runtime config.
 * - Asserts we differentiate platform keys vs webhook secrets.
 */
describe('Stripe Connect env (step 2.0)', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('assertStripeConnectEnv', () => {
    it('throws when STRIPE_SECRET_KEY is missing', async () => {
      delete process.env.STRIPE_SECRET_KEY
      process.env.STRIPE_CONNECT_CLIENT_ID = 'ca_xxx'
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET = 'whsec_xxx'
      const { assertStripeConnectEnv } = await import('@/lib/stripe/platform')
      expect(() => assertStripeConnectEnv()).toThrow()
    })

    it('throws when STRIPE_CONNECT_CLIENT_ID is missing', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
      delete process.env.STRIPE_CONNECT_CLIENT_ID
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET = 'whsec_xxx'
      const { assertStripeConnectEnv } = await import('@/lib/stripe/platform')
      expect(() => assertStripeConnectEnv()).toThrow()
    })

    it('throws when STRIPE_CONNECT_WEBHOOK_SECRET is missing', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
      process.env.STRIPE_CONNECT_CLIENT_ID = 'ca_xxx'
      delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET
      const { assertStripeConnectEnv } = await import('@/lib/stripe/platform')
      expect(() => assertStripeConnectEnv()).toThrow()
    })

    it('does not throw when all required Connect env vars are set', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
      process.env.STRIPE_CONNECT_CLIENT_ID = 'ca_xxx'
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET = 'whsec_xxx'
      const { assertStripeConnectEnv } = await import('@/lib/stripe/platform')
      expect(() => assertStripeConnectEnv()).not.toThrow()
    })
  })

  describe('platform keys vs webhook secrets', () => {
    it('exposes platform secret and webhook secret as separate named values', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_platform'
      process.env.STRIPE_CONNECT_CLIENT_ID = 'ca_xxx'
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET = 'whsec_webhook'
      const { getStripeConnectEnv } = await import('@/lib/stripe/platform')
      const env = getStripeConnectEnv()
      expect(env.platformSecretKey).toBe('sk_test_platform')
      expect(env.webhookSecret).toBe('whsec_webhook')
      expect(env.platformSecretKey).not.toBe(env.webhookSecret)
    })
  })

  describe('getPlatformStripe', () => {
    it('returns a Stripe-like instance when STRIPE_SECRET_KEY is set', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
      const { getPlatformStripe } = await import('@/lib/stripe/platform')
      const stripe = getPlatformStripe()
      expect(stripe).toBeDefined()
      expect(stripe).toBeTypeOf('object')
      // Stripe client has standard methods; we do not call them (no network)
      expect('customers' in stripe || 'paymentIntents' in stripe).toBe(true)
    })

    it('throws when STRIPE_SECRET_KEY is missing', async () => {
      delete process.env.STRIPE_SECRET_KEY
      const { getPlatformStripe } = await import('@/lib/stripe/platform')
      expect(() => getPlatformStripe()).toThrow()
    })
  })
})
