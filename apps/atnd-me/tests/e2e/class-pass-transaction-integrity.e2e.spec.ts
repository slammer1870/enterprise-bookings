/**
 * Class-pass transaction integrity E2E tests.
 *
 * Regression suite for the bug where transactions were duplicated on booking creation:
 *   - bookSingleSlotTimeslotOrRedirect (schedule "Book" CTA) was manually creating a
 *     transaction AND the createBookingTransactionOnCreate afterChange hook was also
 *     creating one → 2 transactions per booking.
 *   - createBookings (booking page) had the same duplication in its new-booking loop.
 *
 * Each test verifies two things through the real browser + full app stack:
 *   1. The class pass quantity is decremented by exactly the right amount.
 *   2. Exactly the right number of transactions exist (1 per booking, no duplicates).
 *
 * Scenarios:
 *   A. Schedule "Book" CTA (bookSingleSlotTimeslotOrRedirect) — 1 slot → qty -1, 1 txn
 *   B. Booking page (createBookings, qty=1) — 1 slot → qty -1, 1 txn
 *   C. Booking page (createBookings, qty=2) — 2 slots → qty -2, 2 txns
 */

import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  getPayloadInstance,
} from './helpers/data-helpers'
import { uniqueClassName } from '@repo/testing-config/src/playwright'
import { advanceScheduleToDate } from './helpers/schedule-helpers'
import { e2eSlowTestTimeout } from './helpers/timeouts'

// ─── Local helpers ─────────────────────────────────────────────────────────────

function futureDate(daysFromNow: number, hour = 10): Date {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, 0, 0, 0)
  return d
}

async function navigateToSchedule(page: any, tenantSlug: string, targetDate: Date) {
  await navigateToTenant(page, tenantSlug, '/')
  await page
    .waitForURL((url: URL) => url.pathname === '/' || url.pathname === '/home', { timeout: 15000 })
    .catch(() => null)
  await expect(page.getByText(/loading schedule/i)).not.toBeVisible({ timeout: 15000 }).catch(() => null)
  await advanceScheduleToDate(page, targetDate)
  await expect(page.getByText('No timeslots scheduled for today')).not.toBeVisible({ timeout: 5000 }).catch(() => null)
}

async function getLessonBookButton(
  page: any,
  scheduleTitle: string,
  buttonName: RegExp | string = /^book$/i,
) {
  const lessonTitles = page.getByText(scheduleTitle, { exact: true })
  await expect(lessonTitles.first()).toBeVisible({ timeout: 20000 })

  const count = await lessonTitles.count()
  for (let i = 0; i < count; i++) {
    const lessonRow = lessonTitles.nth(i).locator('xpath=ancestor::div[contains(@class,"border-b")]').first()
    const btn = lessonRow.getByRole('button', { name: buttonName })
    if ((await btn.count()) > 0) return btn
  }
  const lessonRow = lessonTitles.first().locator('xpath=ancestor::div[contains(@class,"border-b")]').first()
  return lessonRow.getByRole('button', { name: buttonName })
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Class-pass transaction integrity', () => {
  test.setTimeout(e2eSlowTestTimeout())
  test.describe.configure({ mode: 'serial' })

  // ── Scenario A: Schedule "Book" CTA ──────────────────────────────────────────

  test(
    'A: schedule Book CTA (1 slot) creates exactly 1 transaction and decrements pass by 1',
    async ({ page, testData }) => {
      const payload = await getPayloadInstance()
      const tenant = testData.tenants[0]!
      const user = testData.users.user1
      const w = testData.workerIndex

      if (!tenant?.id || !tenant.slug || !user?.email) throw new Error('Expected tenant and user fixtures')

      await payload.update({
        collection: 'tenants',
        id: tenant.id,
        data: { stripeConnectOnboardingStatus: 'active', stripeConnectAccountId: null },
        overrideAccess: true,
      })

      const className = uniqueClassName(`E2E TxnIntegrity Sched ${tenant.id}`)
      const eventType = await createTestEventType(tenant.id, className, 10, 'Tx integrity sched class', w)

      const cpt = (await payload.create({
        collection: 'class-pass-types',
        data: {
          name: `E2E TxIntA 5-Pack w${w} ${Date.now()}`,
          slug: `e2e-txinta-${tenant.id}-${w}-${Date.now()}`,
          quantity: 5,
          maxBookingsPerTimeslot: 1,
          tenant: tenant.id,
          priceInformation: { price: 19.99 },
          skipSync: true,
          stripeProductId: `prod_txinta_${tenant.id}_${w}_${Date.now()}`,
        } as any,
        overrideAccess: true,
      })) as { id: number }

      await payload.update({
        collection: 'event-types',
        id: eventType.id,
        data: { paymentMethods: { allowedClassPasses: [cpt.id] } },
        overrideAccess: true,
      })

      const future = new Date(Date.now() + 86400000 * 60)
      const pass = (await payload.create({
        collection: 'class-passes',
        data: {
          user: user.id,
          tenant: tenant.id,
          type: cpt.id,
          quantity: 5,
          expirationDate: future.toISOString().slice(0, 10),
          purchasedAt: new Date().toISOString(),
          status: 'active',
        },
        overrideAccess: true,
      })) as { id: number }

      const startTime = futureDate(12 + w)
      const endTime = futureDate(12 + w, 11)
      const lesson = await createTestTimeslot(tenant.id, eventType.id, startTime, endTime, undefined, true)

      await loginAsRegularUserViaApi(page, user.email, 'password', { tenantSlug: tenant.slug })
      await navigateToSchedule(page, tenant.slug, startTime)

      const scheduleTitle = `${className} ${tenant.id}${w > 0 ? ` w${w}` : ''}`
      const bookBtn = await getLessonBookButton(page, scheduleTitle)
      await expect(bookBtn).toBeVisible({ timeout: 10000 })

      // Wait for the tRPC call to complete before asserting
      const trpcCall = page.waitForResponse(
        (r: any) =>
          r.url().includes('bookSingleSlotTimeslotOrRedirect') &&
          r.request().method() === 'POST' &&
          r.status() === 200,
        { timeout: 20000 },
      )
      await Promise.all([trpcCall, bookBtn.click()])

      // Button should become "Cancel Booking" (maxBookingsPerTimeslot: 1)
      const cancelBtn = await getLessonBookButton(page, scheduleTitle, /cancel booking/i)
      await expect(cancelBtn).toBeVisible({ timeout: 15000 })

      // ── Assertion 1: class pass decremented by exactly 1 (5 → 4) ────────────
      await expect
        .poll(
          async () => {
            const passAfter = (await payload.findByID({
              collection: 'class-passes',
              id: pass.id,
              depth: 0,
              overrideAccess: true,
            })) as { quantity: number }
            return passAfter.quantity
          },
          { timeout: 10000, message: 'class pass quantity should be 4 after 1 booking' },
        )
        .toBe(4)

      // ── Assertion 2: exactly 1 transaction exists for the created booking ────
      const bookings = await payload.find({
        collection: 'bookings',
        where: {
          and: [
            { user: { equals: user.id } },
            { timeslot: { equals: lesson.id } },
            { status: { equals: 'confirmed' } },
          ],
        },
        depth: 0,
        limit: 5,
        overrideAccess: true,
      })
      expect(bookings.totalDocs).toBeGreaterThanOrEqual(1)

      const bookingId = (bookings.docs[0] as { id: number }).id
      const txResult = await payload.find({
        collection: 'transactions' as any,
        where: { booking: { equals: bookingId } },
        overrideAccess: true,
      })
      expect(txResult.totalDocs).toBe(1)
      expect((txResult.docs[0] as { paymentMethod?: string }).paymentMethod).toBe('class_pass')
    },
  )

  // ── Scenario B: Booking page, qty = 1 ────────────────────────────────────────

  test(
    'B: booking page (qty=1) creates exactly 1 transaction and decrements pass by 1',
    async ({ page, testData }) => {
      const payload = await getPayloadInstance()
      const tenant = testData.tenants[0]!
      const user = testData.users.user1
      const w = testData.workerIndex

      if (!tenant?.id || !tenant.slug || !user?.email) throw new Error('Expected tenant and user fixtures')

      await payload.update({
        collection: 'tenants',
        id: tenant.id,
        data: { stripeConnectOnboardingStatus: 'active', stripeConnectAccountId: null },
        overrideAccess: true,
      })

      const className = uniqueClassName(`E2E TxnIntegrity Bkg1 ${tenant.id}`)
      const eventType = await createTestEventType(tenant.id, className, 10, 'Tx integrity bkg1 class', w)

      const cpt = (await payload.create({
        collection: 'class-pass-types',
        data: {
          name: `E2E TxIntB 5-Pack w${w} ${Date.now()}`,
          slug: `e2e-txintb-${tenant.id}-${w}-${Date.now()}`,
          quantity: 5,
          tenant: tenant.id,
          priceInformation: { price: 19.99 },
          skipSync: true,
          stripeProductId: `prod_txintb_${tenant.id}_${w}_${Date.now()}`,
        } as any,
        overrideAccess: true,
      })) as { id: number }

      await payload.update({
        collection: 'event-types',
        id: eventType.id,
        data: { paymentMethods: { allowedClassPasses: [cpt.id] } },
        overrideAccess: true,
      })

      const future = new Date(Date.now() + 86400000 * 60)
      const pass = (await payload.create({
        collection: 'class-passes',
        data: {
          user: user.id,
          tenant: tenant.id,
          type: cpt.id,
          quantity: 5,
          expirationDate: future.toISOString().slice(0, 10),
          purchasedAt: new Date().toISOString(),
          status: 'active',
        },
        overrideAccess: true,
      })) as { id: number }

      const startTime = futureDate(14 + w)
      const endTime = futureDate(14 + w, 11)
      const lesson = await createTestTimeslot(tenant.id, eventType.id, startTime, endTime, undefined, true)

      await loginAsRegularUserViaApi(page, user.email, 'password', { tenantSlug: tenant.slug })
      await navigateToTenant(page, tenant.slug, '/')
      await page.waitForLoadState('domcontentloaded').catch(() => null)
      await navigateToTenant(page, tenant.slug, `/bookings/${lesson.id}`)
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

      await expect(
        page.getByText(/select quantity|number of slots|book|payment methods/i).first(),
      ).toBeVisible({ timeout: 15000 })

      // qty=1 is the default — no need to click increase
      await page.waitForTimeout(2000)

      const classPassTab = page.getByRole('tab', { name: /class pass/i })
      await expect(classPassTab).toBeVisible({ timeout: 15000 })
      await classPassTab.click()

      await expect(
        page.getByText(/use this pass|confirm with class pass|credits? remaining/i).first(),
      ).toBeVisible({ timeout: 15000 })

      const confirmBtn = page.getByRole('button', { name: /confirm with class pass|book|use pass/i }).first()
      await expect(confirmBtn).toBeVisible()
      await confirmBtn.click()

      await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 20000 })
      await expect(page.getByText(/your booking has been confirmed/i)).toBeVisible()

      // ── Assertion 1: class pass decremented by exactly 1 (5 → 4) ────────────
      await expect
        .poll(
          async () => {
            const passAfter = (await payload.findByID({
              collection: 'class-passes',
              id: pass.id,
              depth: 0,
              overrideAccess: true,
            })) as { quantity: number }
            return passAfter.quantity
          },
          { timeout: 10000, message: 'class pass quantity should be 4 after 1 booking' },
        )
        .toBe(4)

      // ── Assertion 2: exactly 1 transaction per booking ────────────────────────
      const bookings = await payload.find({
        collection: 'bookings',
        where: {
          and: [
            { user: { equals: user.id } },
            { timeslot: { equals: lesson.id } },
            { status: { equals: 'confirmed' } },
          ],
        },
        depth: 0,
        limit: 5,
        overrideAccess: true,
      })
      expect(bookings.totalDocs).toBe(1)

      const bookingId = (bookings.docs[0] as { id: number }).id
      const txResult = await payload.find({
        collection: 'transactions' as any,
        where: { booking: { equals: bookingId } },
        overrideAccess: true,
      })
      expect(txResult.totalDocs).toBe(1)
      expect((txResult.docs[0] as { paymentMethod?: string }).paymentMethod).toBe('class_pass')
    },
  )

  // ── Scenario C: Booking page, qty = 2 ────────────────────────────────────────

  test(
    'C: booking page (qty=2) creates exactly 2 transactions and decrements pass by 2',
    async ({ page, testData }) => {
      const payload = await getPayloadInstance()
      const tenant = testData.tenants[0]!
      const user = testData.users.user1
      const w = testData.workerIndex

      if (!tenant?.id || !tenant.slug || !user?.email) throw new Error('Expected tenant and user fixtures')

      await payload.update({
        collection: 'tenants',
        id: tenant.id,
        data: { stripeConnectOnboardingStatus: 'active', stripeConnectAccountId: null },
        overrideAccess: true,
      })

      const className = uniqueClassName(`E2E TxnIntegrity Bkg2 ${tenant.id}`)
      const eventType = await createTestEventType(tenant.id, className, 10, 'Tx integrity bkg2 class', w)

      const cpt = (await payload.create({
        collection: 'class-pass-types',
        data: {
          name: `E2E TxIntC 5-Pack w${w} ${Date.now()}`,
          slug: `e2e-txintc-${tenant.id}-${w}-${Date.now()}`,
          quantity: 5,
          maxBookingsPerTimeslot: 2,
          tenant: tenant.id,
          priceInformation: { price: 19.99 },
          skipSync: true,
          stripeProductId: `prod_txintc_${tenant.id}_${w}_${Date.now()}`,
        } as any,
        overrideAccess: true,
      })) as { id: number }

      await payload.update({
        collection: 'event-types',
        id: eventType.id,
        data: { paymentMethods: { allowedClassPasses: [cpt.id] } },
        overrideAccess: true,
      })

      const future = new Date(Date.now() + 86400000 * 60)
      const pass = (await payload.create({
        collection: 'class-passes',
        data: {
          user: user.id,
          tenant: tenant.id,
          type: cpt.id,
          quantity: 5,
          expirationDate: future.toISOString().slice(0, 10),
          purchasedAt: new Date().toISOString(),
          status: 'active',
        },
        overrideAccess: true,
      })) as { id: number }

      const startTime = futureDate(16 + w)
      const endTime = futureDate(16 + w, 11)
      const lesson = await createTestTimeslot(tenant.id, eventType.id, startTime, endTime, undefined, true)

      await loginAsRegularUserViaApi(page, user.email, 'password', { tenantSlug: tenant.slug })
      await navigateToTenant(page, tenant.slug, '/')
      await page.waitForLoadState('domcontentloaded').catch(() => null)
      await navigateToTenant(page, tenant.slug, `/bookings/${lesson.id}`)
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

      await expect(
        page.getByText(/select quantity|number of slots|book|payment methods/i).first(),
      ).toBeVisible({ timeout: 15000 })

      // Increase to qty=2
      const increaseBtn = page.getByRole('button', { name: /increase quantity/i }).first()
      await expect(increaseBtn).toBeVisible({ timeout: 15000 })
      await increaseBtn.click()
      await page.waitForTimeout(2000)

      const classPassTab = page.getByRole('tab', { name: /class pass/i })
      await expect(classPassTab).toBeVisible({ timeout: 15000 })
      await classPassTab.click()

      await expect(
        page.getByText(/use this pass|confirm with class pass|credits? remaining/i).first(),
      ).toBeVisible({ timeout: 15000 })

      const confirmBtn = page.getByRole('button', { name: /confirm with class pass|book|use pass/i }).first()
      await expect(confirmBtn).toBeVisible()
      await confirmBtn.click()

      await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 20000 })
      await expect(page.getByText(/your booking has been confirmed/i)).toBeVisible()

      // ── Assertion 1: class pass decremented by exactly 2 (5 → 3) ────────────
      await expect
        .poll(
          async () => {
            const passAfter = (await payload.findByID({
              collection: 'class-passes',
              id: pass.id,
              depth: 0,
              overrideAccess: true,
            })) as { quantity: number }
            return passAfter.quantity
          },
          { timeout: 10000, message: 'class pass quantity should be 3 after 2 bookings' },
        )
        .toBe(3)

      // ── Assertion 2: exactly 1 transaction per booking (2 bookings → 2 txns) ─
      const bookings = await payload.find({
        collection: 'bookings',
        where: {
          and: [
            { user: { equals: user.id } },
            { timeslot: { equals: lesson.id } },
            { status: { equals: 'confirmed' } },
          ],
        },
        depth: 0,
        limit: 5,
        overrideAccess: true,
      })
      expect(bookings.totalDocs).toBe(2)

      // Each booking must have exactly 1 transaction — no duplicates
      for (const booking of bookings.docs) {
        const txResult = await payload.find({
          collection: 'transactions' as any,
          where: { booking: { equals: (booking as { id: number }).id } },
          overrideAccess: true,
        })
        expect(txResult.totalDocs).toBe(1)
        expect((txResult.docs[0] as { paymentMethod?: string }).paymentMethod).toBe('class_pass')
      }
    },
  )
})
