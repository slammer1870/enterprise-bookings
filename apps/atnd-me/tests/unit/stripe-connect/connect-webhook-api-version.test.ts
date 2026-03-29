import { describe, it, expect, afterEach, vi } from 'vitest'
import { PLATFORM_STRIPE_API_VERSION } from '@/lib/stripe/platform'
import {
  assertConnectWebhookEventApiVersion,
  warnIfConnectWebhookEventApiVersionMismatch,
} from '@/lib/stripe-connect/connectWebhookApiVersion'

describe('connectWebhookApiVersion', () => {
  afterEach(() => {
    delete process.env.STRIPE_ENFORCE_WEBHOOK_API_VERSION
  })

  it('assertConnectWebhookEventApiVersion is a no-op when enforcement is disabled via env', () => {
    process.env.STRIPE_ENFORCE_WEBHOOK_API_VERSION = 'false'
    expect(() =>
      assertConnectWebhookEventApiVersion({ api_version: '2011-01-01' }),
    ).not.toThrow()
  })

  it('assertConnectWebhookEventApiVersion throws by default when version differs', () => {
    expect(() =>
      assertConnectWebhookEventApiVersion({ api_version: '2011-01-01' }),
    ).toThrow(/api_version mismatch/)
  })

  it('assertConnectWebhookEventApiVersion passes when version matches (default enforce)', () => {
    expect(() =>
      assertConnectWebhookEventApiVersion({ api_version: PLATFORM_STRIPE_API_VERSION }),
    ).not.toThrow()
  })

  it('warnIfConnectWebhookEventApiVersionMismatch logs when versions differ and enforce is off', () => {
    process.env.STRIPE_ENFORCE_WEBHOOK_API_VERSION = 'false'
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnIfConnectWebhookEventApiVersionMismatch({ api_version: '2011-01-01' })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
