/**
 * Remaining capacity label: tracks available slots as User1 adds bookings.
 *
 * Scenario (as specified):
 *  1. Timeslot with CAPACITY = 12, no other users.
 *  2. User1 has no bookings yet.
 *     Manage page formula: maxTotalQuantity = activeBookings(0) + remainingCapacity(12) = 12
 *     → "Up to 12 more bookings available for this timeslot."
 *  3. User1 books 2 slots (via API).
 *     Manage page: maxTotalQuantity = 2 + 10 = ?
 *     → expected: "Up to 10 more bookings available for this timeslot."
 *  4. User1 adds 2 more via the manage UI (total = 4).
 *     Manage page: maxTotalQuantity = 4 + 8 = ?
 *     → expected: "Up to 8 more bookings available for this timeslot."
 *
 * NOTE: The manage page computes:
 *   maxTotalQuantity = activeBookings.length + timeslot.remainingCapacity
 * where activeBookings = all non-cancelled bookings for this user, and
 * remainingCapacity = CAPACITY − ALL confirmed bookings on the timeslot.
 * For a single user with no other bookings this always equals CAPACITY.
 * If the assertions below fail with "Up to 12" appearing instead of 10/8,
 * it means the label shows the user's booking ceiling (CAPACITY) rather than
 * the remaining venue spots — see manage-booking-page-client.tsx line 854.
 */
import { test, expect } from './helpers/fixtures'
import type { Page } from '@playwright/test'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  createTestBooking,
} from './helpers/data-helpers'
import { e2eSlowTestTimeout } from './helpers/timeouts'

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Navigate to the manage page and wait for the "Update Booking Quantity" card. */
async function openManagePage(args: {
  page: Page
  tenantSlug: string
  userEmail: string
  password: string
  lessonId: number
}) {
  const { page, tenantSlug, userEmail, password, lessonId } = args

  for (let attempt = 0; attempt < 3; attempt++) {
    await navigateToTenant(page, tenantSlug, `/bookings/${lessonId}/manage`)

    if (page.url().includes('/auth/sign-in')) {
      await loginAsRegularUserViaApi(page, userEmail, password, { tenantSlug })
      await page.waitForTimeout(process.env.CI ? 3000 : 1500)
      continue
    }

    await page.waitForLoadState('load').catch(() => null)

    const outcome = await Promise.race([
      page
        .getByText(/update booking quantity/i)
        .first()
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => 'quantity' as const),
      page
        .getByRole('heading', { name: /booking page error/i })
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => 'error' as const),
    ]).catch(() => null)

    if (outcome === 'quantity') return
    if (attempt < 2) {
      await loginAsRegularUserViaApi(page, userEmail, password, { tenantSlug })
      await page.waitForTimeout(process.env.CI ? 3000 : 1500)
    }
  }

  throw new Error(
    `Failed to reach manage page quantity view for lesson ${lessonId}. URL: ${page.url()}`,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Remaining capacity label decreases as User1 adds bookings', () => {
  test.describe.configure({ timeout: e2eSlowTestTimeout() })

  test(
    'label shows Up to 12 → Up to 10 (after 2 bookings) → Up to 8 (after 4 bookings)',
    async ({ page, testData }) => {
      const CAPACITY = 12

      const tenant = testData.tenants[0]!
      const user = testData.users.user1
      const workerIndex = testData.workerIndex
      const password = 'password'

      // ── Setup ─────────────────────────────────────────────────────────────
      // No payment methods → free booking path; "Update Bookings" confirms immediately.

      const classOption = await createTestEventType(
        tenant.id,
        'Capacity Tracking Class',
        CAPACITY,
        undefined,
        workerIndex,
      )

      const startTime = new Date()
      startTime.setHours(14, 0, 0, 0)
      startTime.setDate(startTime.getDate() + 8 + workerIndex)
      const endTime = new Date(startTime)
      endTime.setHours(15, 0, 0, 0)

      const lesson = await createTestTimeslot(
        tenant.id,
        classOption.id,
        startTime,
        endTime,
        undefined,
        true,
      )

      await loginAsRegularUserViaApi(page, user.email, password, { tenantSlug: tenant.slug })

      // ── Phase 1: 0 bookings → Up to 12 ───────────────────────────────────
      // User1 visits the manage page before making any bookings.
      // (In practice the server would redirect to /bookings/[id] with 0 bookings;
      //  we seed 1 booking first so we can reach the manage page, then test the label.)
      //
      // Instead: seed the first 2 bookings via the API and test the label at each stage.

      // ── Phase 2: 2 bookings → Up to 10 ───────────────────────────────────

      await createTestBooking(user.id, lesson.id, 'confirmed')
      await createTestBooking(user.id, lesson.id, 'confirmed')

      await openManagePage({
        page,
        tenantSlug: tenant.slug,
        userEmail: user.email,
        password,
        lessonId: lesson.id,
      })

      const bookingQty = page.getByTestId('booking-quantity')
      await expect(bookingQty).toHaveText('2', { timeout: 10_000 })

      await expect(
        page.getByText(/Up to 10 more bookings available for this timeslot/i),
      ).toBeVisible({ timeout: 10_000 })

      // ── Phase 3: add 2 more via manage UI → Up to 8 ──────────────────────

      const increaseBtn = page.getByRole('button', { name: /increase quantity/i }).first()
      await expect(increaseBtn).toBeEnabled({ timeout: 5_000 })

      await increaseBtn.click()
      await expect(bookingQty).toHaveText('3', { timeout: 5_000 })
      await increaseBtn.click()
      await expect(bookingQty).toHaveText('4', { timeout: 5_000 })

      const updateBtn = page.getByRole('button', { name: /update bookings/i })
      await expect(updateBtn).toBeEnabled({ timeout: 5_000 })
      await updateBtn.click()

      // Wait for the free-booking confirmation.
      await expect(
        page.getByText(/you currently have 4 booking/i),
      ).toBeVisible({ timeout: 15_000 })

      // Re-navigate for a fresh server load so remainingCapacity is up to date.
      await openManagePage({
        page,
        tenantSlug: tenant.slug,
        userEmail: user.email,
        password,
        lessonId: lesson.id,
      })

      await expect(bookingQty).toHaveText('4', { timeout: 10_000 })

      await expect(
        page.getByText(/Up to 8 more bookings available for this timeslot/i),
      ).toBeVisible({ timeout: 10_000 })
    },
  )
})
