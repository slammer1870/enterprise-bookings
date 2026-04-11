import { test, expect } from '@playwright/test'
import { ensureAdminLoggedIn, saveObjectAndWaitForNavigation } from './helpers'
import {
  createEventType,
  uniqueClassName,
} from '@repo/testing-config/src/playwright'

// shared helpers now come from @repo/testing-config (bru-grappling standard)

test.describe('Admin Timeslot Creation Flow (kyuzo)', () => {
  test.setTimeout(180000)

  test('should create class option and a lesson for tomorrow', async ({ page }) => {
    await ensureAdminLoggedIn(page)

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStart = new Date(tomorrow)
    tomorrowStart.setHours(0, 0, 0, 0)
    const tomorrowEnd = new Date(tomorrow)
    tomorrowEnd.setHours(23, 59, 59, 999)

    const className = uniqueClassName('E2E Test Class')
    await createEventType(page, {
      name: className,
      description: 'A test class option for kyuzo e2e',
    })

    await saveObjectAndWaitForNavigation(page, {
      apiPath: '/api/event-types',
      expectedUrlPattern: /\/admin\/collections\/event-types\/\d+/,
      collectionName: 'event-types',
    })

    const classOptionId = (() => {
      const m = page.url().match(/\/admin\/collections\/event-types\/(\d+)/)
      if (!m?.[1]) throw new Error(`Could not extract class-option id from URL: ${page.url()}`)
      return parseInt(m[1], 10)
    })()

    // If a lesson already exists for this class option tomorrow (e.g. test retry), reuse it.
    const existingTimeslotRes = await page.context().request.get(
      `/api/timeslots?limit=1&depth=0&where[and][0][classOption][equals]=${classOptionId}` +
        `&where[and][1][startTime][greater_than_equal]=${encodeURIComponent(tomorrowStart.toISOString())}` +
        `&where[and][2][startTime][less_than_equal]=${encodeURIComponent(tomorrowEnd.toISOString())}`,
    )

    const desiredStart = new Date(tomorrowStart)
    desiredStart.setHours(10, 0, 0, 0)
    const desiredEnd = new Date(tomorrowStart)
    desiredEnd.setHours(11, 0, 0, 0)

    const createTimeslotViaApi = async (): Promise<number> => {
      const createRes = await page.context().request.post(`/api/timeslots`, {
        data: {
          date: tomorrowStart.toISOString(),
          startTime: desiredStart.toISOString(),
          endTime: desiredEnd.toISOString(),
          lockOutTime: 0,
          classOption: classOptionId,
        },
      })

      if (!createRes.ok()) {
        const txt = await createRes.text().catch(() => '')
        throw new Error(`Failed to create lesson via API: ${createRes.status()} ${txt}`)
      }

      const json: any = await createRes.json().catch(() => null)
      const id = json?.doc?.id ?? json?.id
      if (!id) throw new Error(`Timeslot created but no id returned: ${JSON.stringify(json)}`)
      return Number(id)
    }

    let lessonIdFromApi: number | null = null
    if (existingTimeslotRes.ok()) {
      const existingTimeslotJson: any = await existingTimeslotRes.json().catch(() => null)
      const existingTimeslot = existingTimeslotJson?.docs?.[0]
      if (existingTimeslot?.id) {
        lessonIdFromApi = Number(existingTimeslot.id)
      } else {
        lessonIdFromApi = await createTimeslotViaApi()
      }
    } else {
      lessonIdFromApi = await createTimeslotViaApi()
    }

    // quick sanity: lesson exists and is linked to our class option (avoid flaky list filters)
    const lessonId = lessonIdFromApi
    if (!lessonId) throw new Error('Expected lessonId to be set')

    const res = await page.context().request.get(`/api/timeslots/${lessonId}?depth=2`)
    expect(res.ok()).toBeTruthy()
    const body: any = await res.json().catch(() => null)
    const lesson = body?.doc ?? body

    const linkedEventTypeId = lesson?.classOption?.id ?? lesson?.class_option?.id ?? lesson?.classOption
    expect(Number(linkedEventTypeId)).toBe(classOptionId)
  })
})



