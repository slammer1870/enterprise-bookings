import { APIRequestContext, Page, expect, test } from '@playwright/test'
import {
  createEventType,
  ensureAdminLoggedIn,
  ensureAtLeastOneActivePlanWithStripePrice,
  mockSubscriptionCreatedWebhook,
  saveObjectAndWaitForNavigation,
  setEventTypeAllowedPlans,
  uniqueClassName,
  waitForServerReady,
} from '@repo/testing-config/src/playwright'

type TimeslotSnapshot = {
  id: number
  date: string
  startTime: string
  endTime: string
}

const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
const adminEmail = 'admin@example.com'
const adminPassword = 'password123'

async function getAdminAuthHeaders(request: APIRequestContext): Promise<Record<string, string>> {
  const res = await request.post(`${baseUrl}/api/users/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      email: adminEmail,
      password: adminPassword,
    },
    timeout: 30000,
  })

  if (!res.ok()) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to authenticate admin API client: ${res.status()} ${text}`)
  }

  const json: any = await res.json().catch(() => null)
  const token = json?.token ?? json?.doc?.token ?? json?.user?.token

  if (!token || typeof token !== 'string') {
    throw new Error(`Admin login did not return a JWT: ${JSON.stringify(json)}`)
  }

  return {
    Authorization: `JWT ${token}`,
    'Content-Type': 'application/json',
  }
}

async function createTimeslotWithExactTimes(
  request: APIRequestContext,
  headers: Record<string, string>,
  options: {
    eventTypeId: number
    date: string
    startTime: string
    endTime: string
  },
): Promise<number> {
  const res = await request.post(`${baseUrl}/api/timeslots`, {
    headers,
    data: {
      date: options.date,
      startTime: options.startTime,
      endTime: options.endTime,
      eventType: options.eventTypeId,
      lockOutTime: 0,
      active: true,
    },
    timeout: 30000,
  })

  if (!res.ok()) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to create lesson via API: ${res.status()} ${text}`)
  }

  const json: any = await res.json().catch(() => null)
  const lessonId = json?.doc?.id ?? json?.id

  if (!lessonId) {
    throw new Error(`Timeslot create response was missing an id: ${JSON.stringify(json)}`)
  }

  return Number(lessonId)
}

async function fetchTimeslotSnapshotFromPage(
  page: Page,
  lessonId: number,
): Promise<TimeslotSnapshot> {
  const res = await page.context().request.get(`${baseUrl}/api/timeslots/${lessonId}?depth=0`, {
    timeout: 30000,
  })

  if (!res.ok()) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to fetch lesson ${lessonId}: ${res.status()} ${text}`)
  }

  const lesson: any = await res.json().catch(() => null)

  return {
    id: Number(lesson?.id),
    date: String(lesson?.date),
    startTime: String(lesson?.startTime),
    endTime: String(lesson?.endTime),
  }
}

async function fetchConfirmedBookingCountForTimeslotFromPage(
  page: Page,
  lessonId: number,
): Promise<number> {
  const url = new URL(`${baseUrl}/api/bookings`)
  url.searchParams.set('where[and][0][timeslot][equals]', String(lessonId))
  url.searchParams.set('where[and][1][status][equals]', 'confirmed')
  url.searchParams.set('limit', '10')

  const res = await page.context().request.get(url.toString(), {
    timeout: 30000,
  })

  if (!res.ok()) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to fetch bookings for lesson ${lessonId}: ${res.status()} ${text}`)
  }

  const json: any = await res.json().catch(() => null)
  return Number(json?.totalDocs ?? 0)
}

function dublinDayKey(iso: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Dublin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

test.describe('Darkhorse Strength: booking keeps lesson on same Dublin day', () => {
  test.use({ timezoneId: 'Australia/Sydney' })
  test.setTimeout(180000)

  test('confirming a booking does not mutate lesson date/startTime/endTime', async ({ page }) => {
    const request = page.context().request

    await ensureAdminLoggedIn(page)

    const adminHeaders = await getAdminAuthHeaders(request)
    const { planId } = await ensureAtLeastOneActivePlanWithStripePrice(page)

    const className = uniqueClassName('Late Dublin E2E Class')
    await createEventType(page, {
      name: className,
      description: 'Repro for lesson day shift after booking',
    })
    await saveObjectAndWaitForNavigation(page, {
      apiPath: '/api/event-types',
      expectedUrlPattern: /\/admin\/collections\/event-types\/\d+/,
      collectionName: 'event-types',
    })

    const eventTypeId = (() => {
      const match = page.url().match(/\/admin\/collections\/event-types\/(\d+)/)
      if (!match?.[1]) throw new Error(`Could not extract class option id from ${page.url()}`)
      return Number(match[1])
    })()

    await setEventTypeAllowedPlans(page, { eventTypeId, planIds: [planId] })

    // Use a late-evening winter Dublin lesson so any accidental day rebasing is obvious
    // without depending on timezone helper packages in the Playwright runtime.
    const lessonDate = new Date('2030-01-15T00:00:00.000Z')
    const lessonStart = new Date('2030-01-15T23:30:00.000Z')
    const lessonEnd = new Date('2030-01-15T23:45:00.000Z')

    const lessonId = await createTimeslotWithExactTimes(request, adminHeaders, {
      eventTypeId,
      date: lessonDate.toISOString(),
      startTime: lessonStart.toISOString(),
      endTime: lessonEnd.toISOString(),
    })

    await page.goto('/dashboard', { waitUntil: 'load', timeout: 60000 })
    const beforeBooking = await fetchTimeslotSnapshotFromPage(page, lessonId)

    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(request)

    const email = `booking-shift-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
    const password = 'Password123!'

    await page.evaluate(
      async ({ email, password }) => {
        const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

        const postJson = async (url: string, body: unknown) =>
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

        const shouldRetryStatus = (status: number) =>
          status === 429 || status === 500 || status === 502 || status === 503 || status === 504

        const withRetry = async <T>(run: () => Promise<T>, retries = 3) => {
          let lastError: unknown

          for (let attempt = 0; attempt < retries; attempt++) {
            try {
              return await run()
            } catch (error) {
              lastError = error
              await sleep(500 * (attempt + 1))
            }
          }

          throw lastError
        }

        await withRetry(async () => {
          const signUpRes = await postJson('/api/auth/sign-up/email', {
            email,
            password,
            name: 'Booking Shift Repro User',
          })

          if (!signUpRes.ok && signUpRes.status !== 409) {
            const text = await signUpRes.text().catch(() => '')
            const alreadyExists =
              signUpRes.status === 400 &&
              (text.includes('Value must be unique') ||
                text.toLowerCase().includes('already exists') ||
                text.toLowerCase().includes('unique'))

            if (alreadyExists) return
            if (shouldRetryStatus(signUpRes.status)) {
              throw new Error(`signUp transient failure: ${signUpRes.status} ${text}`)
            }

            throw new Error(`signUp failed: ${signUpRes.status} ${text}`)
          }
        })

        await withRetry(async () => {
          const signInRes = await postJson('/api/auth/sign-in/email', { email, password })

          if (!signInRes.ok) {
            const text = await signInRes.text().catch(() => '')
            if (shouldRetryStatus(signInRes.status)) {
              throw new Error(`signIn transient failure: ${signInRes.status} ${text}`)
            }

            throw new Error(`signIn failed: ${signInRes.status} ${text}`)
          }
        })
      },
      { email, password },
    )

    await mockSubscriptionCreatedWebhook(request, { timeslotId: lessonId, userEmail: email })

    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await ensureAdminLoggedIn(page)
    await page.goto('/dashboard', { waitUntil: 'load', timeout: 60000 })

    await expect
      .poll(async () => fetchConfirmedBookingCountForTimeslotFromPage(page, lessonId), {
        timeout: 30000,
      })
      .toBeGreaterThan(0)

    const afterBooking = await fetchTimeslotSnapshotFromPage(page, lessonId)

    expect(afterBooking.date).toBe(beforeBooking.date)
    expect(afterBooking.startTime).toBe(beforeBooking.startTime)
    expect(afterBooking.endTime).toBe(beforeBooking.endTime)

    expect(dublinDayKey(afterBooking.date)).toBe(dublinDayKey(beforeBooking.date))
    expect(dublinDayKey(afterBooking.startTime)).toBe(dublinDayKey(beforeBooking.startTime))
    expect(dublinDayKey(afterBooking.endTime)).toBe(dublinDayKey(beforeBooking.endTime))
  })
})
