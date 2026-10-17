import { describe, expect, it } from 'vitest'

const SCRIPT_URL = process.env.UMAMI_LIVE_TEST_SCRIPT_URL ?? 'https://bru.donal.me/u.js'
const WEBSITE_ID = process.env.UMAMI_LIVE_TEST_WEBSITE_ID ?? '59da8e2a-f114-432d-9551-d50f04d4e13a'
const COLLECT_PATH = process.env.UMAMI_LIVE_TEST_COLLECT_PATH ?? '/api/u'
const TEST_HOSTNAME = 'staging.brugrappling.ie'
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

describe('Umami staging collector', () => {
  it('accepts a representative revenue event', async () => {
    const runStartedAt = new Date().toISOString()
    const collectorUrl = new URL(COLLECT_PATH, SCRIPT_URL)
    const runId = `live-${runStartedAt}-${Math.random().toString(16).slice(2)}`
    const response = await fetch(collectorUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: `https://${TEST_HOSTNAME}`,
        Referer: `https://${TEST_HOSTNAME}/__umami-live-test`,
        'User-Agent': BROWSER_USER_AGENT,
      },
      body: JSON.stringify({
        type: 'event',
        payload: {
          website: WEBSITE_ID,
          hostname: TEST_HOSTNAME,
          language: 'en-IE',
          referrer: '',
          screen: '1440x900',
          title: 'Umami live integration test',
          url: '/__umami-live-test',
          name: 'Booking Completed',
          data: {
            source: 'live-integration-test',
            test_run: runId,
            app_release: process.env.UMAMI_LIVE_TEST_APP_RELEASE?.trim() || 'live-test',
            app_built_at: process.env.UMAMI_LIVE_TEST_APP_BUILT_AT ?? runStartedAt,
            environment: process.env.UMAMI_LIVE_TEST_APP_ENVIRONMENT ?? 'local-test',
            revenue: 49.99,
            currency: 'EUR',
          },
        },
      }),
    })

    expect(response.status).toBe(200)
    const receipt = (await response.json()) as Record<string, unknown>
    expect(receipt, 'event was rejected as bot traffic').not.toEqual({ beep: 'boop' })
    expect(receipt.sessionId).toEqual(expect.any(String))
    expect(receipt.visitId).toEqual(expect.any(String))
  })
})
