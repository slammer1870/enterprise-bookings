// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { plausibleMock } = vi.hoisted(() => ({
  plausibleMock: vi.fn(),
}))

vi.mock('next-plausible', () => ({
  usePlausible: () => plausibleMock,
}))

import { ANALYTICS_EVENT_NAMES, sanitizeAnalyticsUrl, useAnalyticsTracker } from '@repo/analytics'
import { resolveUmamiAnalyticsConfig } from '@/lib/analytics/config'
import { UMAMI_BEFORE_SEND_SCRIPT } from '@/lib/analytics/umami-before-send'

type WindowWithUmami = typeof window & {
  umami?: { track: ReturnType<typeof vi.fn> }
}

const getUmamiWindow = () => window as WindowWithUmami

describe('sanitizeAnalyticsUrl', () => {
  it('removes sensitive route data and aggregates booking identifiers', () => {
    expect(
      sanitizeAnalyticsUrl(
        'https://brugrappling.ie/success?payment_intent=pi_123&payment_intent_client_secret=pi_123_secret_456&bookingIds=10%2C11',
      ),
    ).toBe('https://brugrappling.ie/success')
    expect(
      sanitizeAnalyticsUrl('https://brugrappling.ie/auth/reset-password?token=secret-token'),
    ).toBe('https://brugrappling.ie/auth/reset-password')
    expect(sanitizeAnalyticsUrl('https://brugrappling.ie/search?q=person%40example.com')).toBe(
      'https://brugrappling.ie/search',
    )
    expect(
      sanitizeAnalyticsUrl(
        'https://brugrappling.ie/complete-booking?mode=login&callbackUrl=%2Fbookings%2F123',
      ),
    ).toBe('https://brugrappling.ie/complete-booking')
    expect(sanitizeAnalyticsUrl('https://brugrappling.ie/join-waitlist?timeslotId=123')).toBe(
      'https://brugrappling.ie/join-waitlist',
    )
    expect(
      sanitizeAnalyticsUrl('https://brugrappling.ie/bookings/123/manage?discount=PERSONAL'),
    ).toBe('https://brugrappling.ie/bookings/_ID_/manage')
  })

  it('retains only approved attribution parameters on public pages', () => {
    expect(
      sanitizeAnalyticsUrl(
        'https://brugrappling.ie/?utm_source=newsletter&utm_campaign=spring&fbclid=click-id&email=person%40example.com#schedule',
      ),
    ).toBe('https://brugrappling.ie/?utm_source=newsletter&utm_campaign=spring')
  })
})

describe('Umami payload sanitization', () => {
  type BeforeSend = (
    _type: string,
    _payload: Record<string, unknown>,
  ) => Record<string, unknown> | false

  const getBeforeSend = () =>
    (window as typeof window & { umamiBeforeSend: BeforeSend }).umamiBeforeSend

  beforeEach(() => {
    window.eval(UMAMI_BEFORE_SEND_SCRIPT)
  })

  it('removes sensitive URL data while preserving campaign attribution', () => {
    const beforeSend = getBeforeSend()

    expect(
      beforeSend('event', {
        website: 'test',
        url: 'https://brugrappling.ie/bookings/123/manage?utm_source=newsletter&discount=SECRET#details',
      }),
    ).toMatchObject({
      website: 'test',
      url: '/bookings/_ID_/manage?utm_source=newsletter',
    })
    expect(
      beforeSend('event', {
        url: 'https://brugrappling.ie/success?payment_intent_client_secret=secret',
      }),
    ).toMatchObject({ url: '/success' })
  })

  it('deduplicates immediate sanitized pageviews without dropping custom events', () => {
    const beforeSend = getBeforeSend()
    const pageview = { url: 'https://brugrappling.ie/success?payment_intent=pi_123' }

    expect(beforeSend('event', pageview)).toMatchObject({ url: '/success' })
    expect(beforeSend('event', pageview)).toBe(false)
    expect(beforeSend('event', { ...pageview, name: 'Booking Completed' })).toMatchObject({
      name: 'Booking Completed',
      url: '/success',
    })
  })
})

describe('analytics provider adapter', () => {
  beforeEach(() => {
    plausibleMock.mockClear()
    localStorage.clear()
    window.history.replaceState({}, '', '/')
    vi.stubEnv('NEXT_PUBLIC_APP_RELEASE', 'a13f0c2')
    vi.stubEnv('NEXT_PUBLIC_APP_BUILT_AT', '2026-09-23T14:12:34.000Z')
    vi.stubEnv('NEXT_PUBLIC_APP_ENVIRONMENT', 'staging')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    document.querySelector('script[data-analytics-provider="umami"]')?.remove()
    delete getUmamiWindow().umami
    window.history.replaceState({}, '', '/')
  })

  it('sends existing event properties and flattened revenue to Umami', () => {
    const tracker = document.createElement('script')
    tracker.dataset.analyticsProvider = 'umami'
    document.head.appendChild(tracker)

    const umamiTrack = vi.fn()
    getUmamiWindow().umami = { track: umamiTrack }
    localStorage.setItem(
      'utm_attribution',
      JSON.stringify({
        utm_source: 'newsletter',
        utm_campaign: 'autumn',
        expires: Date.now() + 60_000,
      }),
    )

    const { result } = renderHook(() => useAnalyticsTracker())
    act(() => {
      result.current.trackEvent('Booking Completed', {
        booking_flow: 'checkout',
        quantity: 2,
        revenue: { amount: 49.99, currency: 'EUR' },
      })
    })

    expect(umamiTrack).toHaveBeenCalledWith('Booking Completed', {
      source: 'newsletter',
      medium: 'organic',
      campaign: 'autumn',
      content: 'none',
      term: 'none',
      has_fbclid: 'false',
      booking_flow: 'checkout',
      quantity: 2,
      app_release: 'a13f0c2',
      app_built_at: '2026-09-23T14:12:34.000Z',
      environment: 'staging',
      revenue: 49.99,
      currency: 'EUR',
    })
    expect(plausibleMock).not.toHaveBeenCalled()
  })

  it('sends every supported analytics event to Umami', () => {
    const tracker = document.createElement('script')
    tracker.dataset.analyticsProvider = 'umami'
    document.head.appendChild(tracker)

    const umamiTrack = vi.fn()
    getUmamiWindow().umami = { track: umamiTrack }
    const { result } = renderHook(() => useAnalyticsTracker())

    act(() => {
      for (const eventName of ANALYTICS_EVENT_NAMES) {
        result.current.trackEvent(eventName, { test_run: true })
      }
    })

    expect(umamiTrack.mock.calls.map(([eventName]) => eventName)).toEqual([
      ...ANALYTICS_EVENT_NAMES,
    ])
    expect(umamiTrack).toHaveBeenCalledTimes(ANALYTICS_EVENT_NAMES.length)
    expect(plausibleMock).not.toHaveBeenCalled()
  })

  it('does not propagate a provider failure into the calling product flow', () => {
    const tracker = document.createElement('script')
    tracker.dataset.analyticsProvider = 'umami'
    document.head.appendChild(tracker)

    getUmamiWindow().umami = {
      track: vi.fn(() => {
        throw new Error('tracker failed')
      }),
    }
    const { result } = renderHook(() => useAnalyticsTracker())

    expect(() => {
      act(() => result.current.trackEvent('Booking Completed', { quantity: 1 }))
    }).not.toThrow()
  })
})

describe('Umami environment configuration', () => {
  const websiteId = '00000000-0000-4000-8000-000000000001'

  it('enables a staging hostname without depending on NODE_ENV', () => {
    const config = resolveUmamiAnalyticsConfig('staging.brugrappling.ie', {
      UMAMI_WEBSITE_ID: websiteId,
      UMAMI_DOMAINS: 'staging.brugrappling.ie, LOCALHOST,staging.brugrappling.ie',
      UMAMI_SCRIPT_URL: 'https://bru.donal.me/u.js',
    })

    expect(config).toEqual({
      enabled: true,
      websiteId,
      scriptUrl: 'https://bru.donal.me/u.js',
      domains: ['staging.brugrappling.ie', 'localhost'],
      domainsAttribute: 'staging.brugrappling.ie,localhost',
    })
  })

  it('keeps analytics disabled for unlisted hosts or missing required values', () => {
    expect(
      resolveUmamiAnalyticsConfig('other.example.com', {
        UMAMI_WEBSITE_ID: websiteId,
        UMAMI_SCRIPT_URL: 'https://bru.donal.me/u.js',
        UMAMI_DOMAINS: 'staging.brugrappling.ie',
      }).enabled,
    ).toBe(false)
    expect(
      resolveUmamiAnalyticsConfig('staging.brugrappling.ie', {
        UMAMI_SCRIPT_URL: 'https://bru.donal.me/u.js',
        UMAMI_DOMAINS: 'staging.brugrappling.ie',
      }).enabled,
    ).toBe(false)
    expect(
      resolveUmamiAnalyticsConfig('staging.brugrappling.ie', {
        UMAMI_WEBSITE_ID: websiteId,
        UMAMI_DOMAINS: 'staging.brugrappling.ie',
      }).enabled,
    ).toBe(false)
  })

  it('rejects unsafe tracker URLs while allowing local HTTP development', () => {
    const common = {
      UMAMI_WEBSITE_ID: websiteId,
      UMAMI_DOMAINS: 'localhost',
    }

    for (const scriptUrl of [
      'javascript:alert(1)',
      'data:text/javascript,alert(1)',
      'http://analytics.example.com/u.js',
      'https://analytics.example.com/u.js',
      'https://bru.donal.me/u.js?unexpected=1',
      'https://user:password@analytics.example.com/u.js',
      'not a URL',
    ]) {
      expect(
        resolveUmamiAnalyticsConfig('localhost', {
          ...common,
          UMAMI_SCRIPT_URL: scriptUrl,
        }).enabled,
      ).toBe(false)
    }

    expect(
      resolveUmamiAnalyticsConfig('localhost', {
        ...common,
        UMAMI_SCRIPT_URL: 'http://localhost:3001/u.js',
      }),
    ).toMatchObject({
      enabled: true,
      scriptUrl: 'http://localhost:3001/u.js',
    })
  })

  it('expands a localhost wildcard to the current tenant hostname for the tracker', () => {
    expect(
      resolveUmamiAnalyticsConfig('test-tenant.localhost', {
        UMAMI_WEBSITE_ID: websiteId,
        UMAMI_SCRIPT_URL: 'https://bru.donal.me/u.js',
        UMAMI_DOMAINS: 'localhost,127.0.0.1,*.localhost',
      }),
    ).toMatchObject({
      enabled: true,
      domainsAttribute: 'localhost,127.0.0.1,test-tenant.localhost',
    })
  })
})
