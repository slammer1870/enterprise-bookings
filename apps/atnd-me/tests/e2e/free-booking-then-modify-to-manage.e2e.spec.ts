/**
 * Free (no-payment-method) booking from the schedule → Modify Booking → manage page.
 *
 * Scenario:
 *  1. A timeslot is created for today with an event type that has NO payment methods
 *     (pay-at-door / free). This makes the booking process instant on the schedule.
 *  2. The user navigates to the tenant home page which renders the heroScheduleSanctuary block
 *     (today's timeslot list with CheckInButton per slot).
 *  3. The user clicks "Book" on the timeslot — no payment required, so the booking is
 *     created immediately via `bookSingleSlotTimeslotOrRedirect` and a "Booked" toast
 *     is shown. The schedule invalidates and refetches.
 *  4. After the schedule refreshes, the CheckInButton now renders "Modify Booking".
 *  5. The user clicks "Modify Booking" → navigates to /bookings/[timeslotId]/manage.
 *  6. The manage page shows the booking details:
 *       • "Update Booking Quantity" card
 *       • "Your Bookings" card with at least one "Booking #" row showing status confirmed
 */
import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { createTestEventType, createTestTimeslot } from './helpers/data-helpers'
import { e2eSlowTestTimeout } from './helpers/timeouts'
import { ensureTenant1ActiveBranchesOnly, tenant1DefaultBranchId } from './helpers/schedule-helpers'

test.describe('Free booking: schedule Book → Modify Booking → manage page details', () => {
  test.setTimeout(e2eSlowTestTimeout())

  test.beforeAll(async ({ testData }) => {
    await ensureTenant1ActiveBranchesOnly(testData)
  })

  test(
    'user books free timeslot from schedule, clicks Modify Booking, manage page shows booking details',
    async ({ page, testData }) => {
      const tenant = testData.tenants[0]!
      const user = testData.users.user1
      const workerIndex = testData.workerIndex

      if (!tenant?.id || !tenant?.slug) throw new Error('Tenant required')

      // ── Setup ────────────────────────────────────────────────────────────────

      // Event type with NO payment methods → free/pay-at-door, instant booking.
      const eventType = await createTestEventType(
        tenant.id,
        'E2E Free Sched Manage',
        10,
        undefined,
        workerIndex,
      )

      // Timeslot for TODAY so it appears in the schedule's default (today) view.
      // Prefer ≥2 h ahead so default lock-out still leaves booking open; late evening
      // falls back to a soon slot with lockOutTime 0 (default 60m would close a 23:00 class).
      const now = new Date()
      const start = new Date(now)
      let lockOutTimeMinutes = 60
      start.setHours(now.getHours() + 2, 0, 0, 0)
      if (start.getDate() !== now.getDate() || now.getHours() >= 22) {
        start.setTime(now.getTime())
        start.setMinutes(now.getMinutes() + 15, 0, 0)
        if (start.getDate() !== now.getDate()) {
          start.setDate(now.getDate())
          start.setHours(23, 0, 0, 0)
        }
        lockOutTimeMinutes = 0
      }
      const end = new Date(start)
      // Keep end on the same calendar day as start (23:00 + 1h would fail timeslot End Time validation).
      if (start.getHours() >= 23) {
        end.setHours(23, 30, 0, 0)
      } else {
        end.setHours(start.getHours() + 1)
        if (end.getDate() !== start.getDate()) {
          end.setTime(start.getTime() + 30 * 60 * 1000)
        }
      }

      const timeslot = await createTestTimeslot(
        tenant.id,
        eventType.id,
        start,
        end,
        undefined, // no instructor
        true,      // active
        tenant1DefaultBranchId(testData),
        lockOutTimeMinutes,
      )

      // The scoped name that createTestEventType produces (mirrors its naming logic).
      const workerSuffix = workerIndex > 0 ? ` w${workerIndex}` : ''
      const eventTypeScopedName = `E2E Free Sched Manage ${tenant.id}${workerSuffix}`

      // ── Step 1: log in and navigate to the tenant home page ──────────────────

      await loginAsRegularUserViaApi(page, user.email, 'password', {
        tenantSlug: tenant.slug,
      })

      await navigateToTenant(page, tenant.slug, '/home')
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => null)

      // ── Step 2: wait for the schedule to render our timeslot ─────────────────

      await expect(
        page.getByText(eventTypeScopedName, { exact: false }).first(),
      ).toBeVisible({ timeout: 20_000 })

      // ── Step 3: click "Book" → booking created instantly (no payment) ────────

      // Locate the Book button within the timeslot row scoped to our event type name.
      // Important: use a separate locator for each state (Book vs Modify Booking) because
      // the timeslot row's filter condition changes once the button text changes.
      const bookBtn = page
        .locator('div')
        .filter({ hasText: eventTypeScopedName })
        .filter({ has: page.getByRole('button', { name: /^book$/i }) })
        .last()
        .getByRole('button', { name: /^book$/i })
        .first()

      await expect(bookBtn).toBeVisible({ timeout: 10_000 })
      await expect(bookBtn).toBeEnabled({ timeout: 5_000 })

      // Wait for the booking mutation request so we know the booking was created.
      const bookingRequest = page.waitForRequest(
        (req) =>
          req.method() === 'POST' &&
          req.url().includes('/api/trpc') &&
          (req.url().includes('bookSingleSlotTimeslotOrRedirect') ||
            (req.postData() ?? '').includes('bookSingleSlotTimeslotOrRedirect')),
        { timeout: 15_000 },
      )

      await Promise.all([bookingRequest, bookBtn.click()])

      // The CheckInButton shows a "Booked" success toast after an instant booking.
      await expect(page.getByText(/^booked$/i).first()).toBeVisible({ timeout: 10_000 })

      // ── Step 4: schedule refreshes → "Modify Booking" button appears ─────────
      //
      // After the booking the schedule query is invalidated and refetched.
      // The CheckInButton now shows "Modify Booking".
      //
      // Scope the locator to the correct timeslot row using the event-type name.
      // A page-level `.first()` can pick up "Modify Booking" buttons from OTHER
      // timeslots that user1 has already booked (from previous tests in this run),
      // leading to a false URL mismatch. Scoping to the row avoids this race.

      const modifyBtn = page
        .locator('div')
        .filter({ hasText: eventTypeScopedName })
        .getByRole('button', { name: /modify booking/i })
        .first()
      await expect(modifyBtn).toBeVisible({ timeout: 15_000 })

      // ── Step 5: click "Modify Booking" → navigate to manage page ─────────────

      await modifyBtn.click()

      await page.waitForURL(new RegExp(`/bookings/${timeslot.id}/manage`), {
        timeout: 15_000,
      })

      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => null)

      // ── Step 6: verify manage page shows booking details ─────────────────────

      // "Update Booking Quantity" card — shown when the user has active bookings.
      await expect(page.getByText(/update booking quantity/i).first()).toBeVisible({
        timeout: 15_000,
      })

      // "Your Bookings" card header.
      await expect(page.getByText(/your bookings/i).first()).toBeVisible({
        timeout: 10_000,
      })

      // At least one booking row: "Booking #<id>" with a confirmed status.
      await expect(page.getByText(/booking #\d+/i).first()).toBeVisible({
        timeout: 10_000,
      })

      await expect(page.getByText(/status:\s*confirmed/i).first()).toBeVisible({
        timeout: 10_000,
      })
    },
  )
})
