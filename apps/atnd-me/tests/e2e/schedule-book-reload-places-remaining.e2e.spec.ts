/**
 * Open a two-place class from the schedule, land on the booking page, and reload.
 *
 * Landing on the page saves a checkout hold of 1. That hold is already
 * subtracted from remaining capacity. A reload still owns it, so the page
 * must keep saying "2 places remaining" and let quantity increase.
 *
 * Production shows "1 place remaining": the next document snapshots capacity
 * while the hold is counted, then release-hold (async, after sync XHR on
 * unload is blocked) drops the hold before the page records it as the viewer's.
 * Playwright otherwise finishes that release before the document is read, the
 * hold is gone, and the label says 2 for the wrong reason. This spec holds
 * release-hold until that capacity snapshot exists, then lets it commit
 * before the viewer-hold lookup.
 *
 * This does not pay or confirm a booking.
 */
import fs from 'fs'
import type { Page, Route } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import {
  e2eHoldReadSplitPaths,
  resetE2eHoldReadSplit,
  signalE2eHoldReadSplit,
} from '../../src/lib/booking/e2e-hold-read-split'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  getPayloadInstance,
  updateTenantStripeConnect,
} from './helpers/data-helpers'
import { advanceScheduleToDate, ensureTenant1ActiveBranchesOnly } from './helpers/schedule-helpers'
import { uniqueClassName } from '@repo/testing-config/src/playwright'
import { e2eSlowTestTimeout } from './helpers/timeouts'

function futureDate(daysFromNow: number, hour = 10): Date {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, 0, 0, 0)
  return d
}

async function openSchedulePage(page: Page, tenantSlug: string, pageSlug: string, targetDate: Date) {
  await navigateToTenant(page, tenantSlug, `/${pageSlug}`)
  await page
    .waitForURL((url) => url.pathname === `/${pageSlug}`, { timeout: 15_000 })
    .catch(() => null)
  await expect(page.getByText(/loading schedule/i))
    .not.toBeVisible({ timeout: 15_000 })
    .catch(() => null)
  await advanceScheduleToDate(page, targetDate)
  await expect(page.getByText('No timeslots scheduled for today'))
    .not.toBeVisible({ timeout: 5_000 })
    .catch(() => null)
}

async function getLessonBookButton(page: Page, scheduleTitle: string) {
  const lessonTitles = page.getByText(scheduleTitle, { exact: true })
  await expect(lessonTitles.first()).toBeVisible({ timeout: 20_000 })

  const count = await lessonTitles.count()
  for (let i = 0; i < count; i++) {
    const lessonRow = lessonTitles
      .nth(i)
      .locator('xpath=ancestor::div[contains(@class,"border-b")]')
      .first()
    const btn = lessonRow.getByRole('button', { name: /^book$/i })
    if ((await btn.count()) > 0) return btn
  }

  const lessonRow = lessonTitles
    .first()
    .locator('xpath=ancestor::div[contains(@class,"border-b")]')
    .first()
  return lessonRow.getByRole('button', { name: /^book$/i })
}

async function countActiveHolds(
  payload: Awaited<ReturnType<typeof getPayloadInstance>>,
  timeslotId: number,
  userId: number,
) {
  const result = await payload.find({
    collection: 'booking-checkout-holds' as import('payload').CollectionSlug,
    where: {
      and: [
        { timeslot: { equals: timeslotId } },
        { user: { equals: userId } },
        { status: { equals: 'active' } },
      ],
    },
    depth: 0,
    limit: 5,
    overrideAccess: true,
  })
  return result.totalDocs ?? 0
}

/**
 * Chrome blocks synchronous XHR during unload and falls through to a keepalive
 * fetch. That fetch commits while the next document is rendering. Playwright
 * lets the sync XHR finish first, which hides the bug, so the sync send throws
 * and the follow-up release-hold is held until the caller flushes it.
 */
async function holdReloadRelease(page: Page) {
  const releasers: Array<() => void> = []
  let asyncStarted = 0
  let asyncFinished = 0

  await page.evaluate(() => {
    const proto = XMLHttpRequest.prototype
    const origOpen = proto.open
    const origSend = proto.send
    proto.open = function (this: XMLHttpRequest & { __releaseHoldUrl?: string }, ...args: unknown[]) {
      this.__releaseHoldUrl = String(args[1] ?? '')
      return origOpen.apply(this, args as unknown as Parameters<XMLHttpRequest['open']>)
    } as typeof proto.open
    proto.send = function (this: XMLHttpRequest & { __releaseHoldUrl?: string }, ...args: unknown[]) {
      if ((this.__releaseHoldUrl ?? '').includes('release-hold')) {
        throw new DOMException('sync XHR blocked on reload', 'NetworkError')
      }
      return origSend.apply(this, args as unknown as Parameters<XMLHttpRequest['send']>)
    } as typeof proto.send
  })

  const onRelease = async (route: Route) => {
    // A sync XHR blocks the document request. Abort it so the page falls through
    // to the keepalive fetch, which is the request production actually races.
    if (route.request().resourceType() === 'xhr') {
      await route.abort('failed')
      return
    }
    asyncStarted += 1
    await new Promise<void>((resolve) => {
      releasers.push(resolve)
    })
    const response = await route.fetch()
    await route.fulfill({ response }).catch(() => {})
    asyncFinished += 1
  }

  await page.route('**/api/bookings/release-hold', onRelease)

  return {
    async flush() {
      const queuedBy = Date.now() + 1_000
      while (asyncStarted === 0 && Date.now() < queuedBy) {
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      const deadline = Date.now() + 10_000
      while (asyncFinished < asyncStarted && Date.now() < deadline) {
        for (const release of releasers.splice(0)) release()
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      if (asyncFinished < asyncStarted) {
        throw new Error('release-hold did not finish before the booking page read the viewer hold')
      }
      return asyncFinished
    },
    async stop() {
      for (const release of releasers.splice(0)) release()
      await page.unroute('**/api/bookings/release-hold', onRelease).catch(() => {})
    },
  }
}

async function waitForHoldReadPause(timeslotId: number) {
  const { paused } = e2eHoldReadSplitPaths(timeslotId)
  const deadline = Date.now() + 40_000
  while (!fs.existsSync(paused)) {
    if (Date.now() > deadline) {
      throw new Error(
        'Booking page did not pause after snapshotting remaining capacity. The e2e server needs PW_E2E_PROFILE and the e2e-split-hold-read cookie.',
      )
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

test.describe('Schedule book: two places remaining survives booking-page reload', () => {
  test.setTimeout(e2eSlowTestTimeout(240_000, 180_000))

  test('reload while the saved hold is still counted still shows 2 adjustable places', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenant = testData.tenants[0]!
    const user = testData.users.user1
    const w = testData.workerIndex

    if (!tenant?.id || !tenant.slug || !user?.email || user.id == null) {
      throw new Error('Expected tenant and user fixtures')
    }

    await ensureTenant1ActiveBranchesOnly(testData)

    await updateTenantStripeConnect(tenant.id, {
      stripeConnectOnboardingStatus: 'active',
      stripeConnectAccountId: `acct_e2e_float_reload_${tenant.id}_${w}`,
    })

    // Adjustable drop-in with no per-user cap, so the label is the venue capacity (2).
    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `E2E Float Reload Drop-in ${tenant.id}-w${w}-${Date.now()}`,
        isActive: true,
        price: 15,
        adjustable: true,
        tenant: tenant.id,
      },
      overrideAccess: true,
    })) as { id: number }

    const className = uniqueClassName(`E2E Float Reload ${tenant.id}`)
    const eventType = await createTestEventType(tenant.id, className, 2, 'Two-place float class', w)
    await payload.update({
      collection: 'event-types',
      id: eventType.id,
      data: {
        paymentMethods: { allowedDropIn: dropIn.id },
        tenant: tenant.id,
      },
      overrideAccess: true,
    })

    const startTime = futureDate(8 + w, 10)
    const endTime = futureDate(8 + w, 11)
    const lesson = await createTestTimeslot(tenant.id, eventType.id, startTime, endTime, undefined, true)

    // Public schedule page, same shape as /float.
    const pageSlug = `float-w${w}-${Date.now()}`
    await payload.create({
      collection: 'pages',
      data: {
        slug: pageSlug,
        title: 'Float',
        tenant: tenant.id,
        _status: 'published',
        layout: [{ blockType: 'schedule', blockName: 'Schedule' }],
      },
      draft: false,
      overrideAccess: true,
    })

    try {
      await loginAsRegularUserViaApi(page, user.email, 'password', { tenantSlug: tenant.slug })
      await openSchedulePage(page, tenant.slug, pageSlug, startTime)

      const scheduleTitle = `${className} ${tenant.id}${w > 0 ? ` w${w}` : ''}`
      const bookBtn = await getLessonBookButton(page, scheduleTitle)
      await expect(bookBtn).toBeVisible({ timeout: 10_000 })

      const bookResponse = page.waitForResponse(
        (response) =>
          response.url().includes('bookSingleSlotTimeslotOrRedirect') &&
          response.request().method() === 'POST' &&
          response.status() === 200,
        { timeout: 20_000 },
      )
      await Promise.all([bookResponse, bookBtn.click()])

      await page.waitForURL((url) => url.pathname === `/bookings/${lesson.id}`, { timeout: 20_000 })

      await expect(page.getByText('Number of Slots', { exact: true })).toBeVisible({ timeout: 20_000 })
      await expect(page.getByText('2 places remaining', { exact: true })).toBeVisible({ timeout: 20_000 })
      // The hold is saved after the booking page paints. Cold dev compiles can
      // sit in front of that request, so wait on the row rather than the response.
      await expect
        .poll(() => countActiveHolds(payload, lesson.id, Number(user.id)), { timeout: 45_000 })
        .toBe(1)

      resetE2eHoldReadSplit(lesson.id)
      await page.context().addCookies([
        {
          name: 'e2e-split-hold-read',
          value: '1',
          url: page.url(),
        },
      ])

      const heldRelease = await holdReloadRelease(page)
      let openedHoldLookup = false
      const reloaded = page.reload({ waitUntil: 'domcontentloaded' })
      try {
        await waitForHoldReadPause(lesson.id)
        const holdsAtSnapshot = await countActiveHolds(payload, lesson.id, Number(user.id))
        if (holdsAtSnapshot !== 1) {
          throw new Error(
            `Remaining capacity was snapshotted with ${holdsAtSnapshot} active holds. Production still counts the viewer's hold of 1.`,
          )
        }
        const released = await heldRelease.flush()
        if (released > 0) {
          await expect
            .poll(() => countActiveHolds(payload, lesson.id, Number(user.id)), { timeout: 10_000 })
            .toBe(0)
        }
        signalE2eHoldReadSplit(lesson.id)
        openedHoldLookup = true
        await reloaded
      } finally {
        if (!openedHoldLookup) signalE2eHoldReadSplit(lesson.id)
        await heldRelease.stop()
        await reloaded.catch(() => {})
        resetE2eHoldReadSplit(lesson.id)
      }

      await expect(page).toHaveURL(new RegExp(`/bookings/${lesson.id}$`))
      await expect(page.getByText('Number of Slots', { exact: true })).toBeVisible({ timeout: 20_000 })
      await expect(
        page.getByText('1 place remaining', { exact: true }),
        'Capacity still included the viewer hold, then release-hold dropped it before the page recorded the hold.',
      ).toHaveCount(0)
      await expect(page.getByText('2 places remaining', { exact: true })).toBeVisible({ timeout: 20_000 })

      await expect(async () => {
        const increase = page.getByRole('button', { name: /increase quantity/i })
        await expect(increase).toBeEnabled()
        await increase.click()
        await expect(increase.locator('xpath=preceding-sibling::span')).toHaveText('2', { timeout: 1_000 })
      }).toPass({ timeout: 20_000 })
    } finally {
      await payload.delete({
        collection: 'pages',
        where: { and: [{ slug: { equals: pageSlug } }, { tenant: { equals: tenant.id } }] },
        overrideAccess: true,
      })
    }
  })
})
