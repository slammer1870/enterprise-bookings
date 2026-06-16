/**
 * E2E: Past timeslot — complete-booking link shows full venue capacity on checkout
 *
 * Scenario:
 *   A timeslot has already ended but still has all 12 places available. Drop-in is
 *   adjustable (no per-user cap), so a user could book every remaining spot in one
 *   session. The user receives the standard complete-booking login link
 *   (`/complete-booking?mode=login&callbackUrl=/bookings/[id]`), signs in via magic
 *   link, and lands on the drop-in checkout page.
 *
 * Expected:
 *   The quantity selector reads "12 slots available" — the full event-type capacity,
 *   not 0/1 from schedule "closed" UI state or an incorrect remaining-capacity calc.
 */
import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  getPayloadInstance,
} from './helpers/data-helpers'
import { clearTestMagicLinks, pollForTestMagicLink } from '@repo/testing-config/src/playwright'
import { e2eSlowTestTimeout } from './helpers/timeouts'

const CAPACITY = 12

test.describe('Past timeslot: complete-booking link shows full capacity on checkout', () => {
  test.describe.configure({ timeout: e2eSlowTestTimeout() })

  test(
    'magic-link login from complete-booking shows "12 slots available" on the drop-in checkout page',
    async ({ page, request, testData }) => {
      test.setTimeout(e2eSlowTestTimeout(180_000, 120_000))

      const payload = await getPayloadInstance()
      const tenant = testData.tenants[0]!
      const user = testData.users.user1
      const workerIndex = testData.workerIndex

      if (!tenant?.id || !tenant.slug || !user?.email) {
        throw new Error('Expected tenant and user fixtures')
      }

      // Stripe Connect so the drop-in tab renders on checkout.
      await payload.update({
        collection: 'tenants',
        id: tenant.id,
        data: {
          stripeConnectOnboardingStatus: 'active',
          stripeConnectAccountId: `acct_past_cap_${tenant.id}`,
        },
        overrideAccess: true,
      })

      const dropIn = (await payload.create({
        collection: 'drop-ins',
        data: {
          name: `Past Lesson Drop-in ${tenant.id}-w${workerIndex}-${Date.now()}`,
          isActive: true,
          price: 10,
          adjustable: true,
          tenant: tenant.id,
        },
        overrideAccess: true,
      })) as { id: number }

      const classOption = await createTestEventType(
        tenant.id,
        'Past Lesson Capacity Class',
        CAPACITY,
        undefined,
        workerIndex,
      )
      await payload.update({
        collection: 'event-types',
        id: classOption.id,
        data: {
          paymentMethods: { allowedDropIn: dropIn.id },
          tenant: tenant.id,
        },
        overrideAccess: true,
      })

      // Timeslot fully in the past (ended 1h ago). lockOutTime 0 avoids extra cutoff edge cases.
      const endTime = new Date(Date.now() - 60 * 60 * 1000)
      const startTime = new Date(endTime.getTime() - 2 * 60 * 60 * 1000)

      const lesson = await createTestTimeslot(
        tenant.id,
        classOption.id,
        startTime,
        endTime,
        undefined,
        true,
      )
      await payload.update({
        collection: 'timeslots',
        id: lesson.id,
        data: { lockOutTime: 0 },
        overrideAccess: true,
      })

      const callbackPath = `/bookings/${lesson.id}`
      const completeBookingPath = `/complete-booking?mode=login&callbackUrl=${encodeURIComponent(callbackPath)}`

      // ── Step 1: unauthenticated user opens the complete-booking link ──────────

      await clearTestMagicLinks(request, user.email)
      await navigateToTenant(page, tenant.slug, completeBookingPath)

      await expect(page.getByText('Log in to your account', { exact: true })).toBeVisible({
        timeout: 20_000,
      })

      const emailInput = page
        .getByRole('textbox', { name: /email/i })
        .or(page.getByPlaceholder(/your email/i))
        .first()
      await emailInput.fill(user.email)
      await page.getByRole('button', { name: /^submit$/i }).click()

      await expect(page.getByRole('heading', { name: /^magic link sent$/i })).toBeVisible({
        timeout: 30_000,
      })

      // ── Step 2: follow magic link → booking checkout page ─────────────────────

      const magicLink = await pollForTestMagicLink(request, user.email)
      await page.goto(magicLink.url, { waitUntil: 'domcontentloaded' })

      await page.waitForURL(
        (url) => url.pathname === callbackPath,
        { timeout: 60_000 },
      )

      // Drop-in checkout (quantity selector + payment methods).
      await expect(page.getByText(`${CAPACITY} slots available`)).toBeVisible({ timeout: 30_000 })
      await expect(page.getByRole('heading', { name: /payment methods/i })).toBeVisible({
        timeout: 30_000,
      })

      // Sanity: user can raise quantity above 1 (adjustable drop-in, capacity-bound only).
      const increaseBtn = page.getByRole('button', { name: /increase quantity/i })
      await expect(increaseBtn).toBeEnabled({ timeout: 10_000 })
      await increaseBtn.click()
      await expect(page.getByRole('button', { name: /decrease quantity/i })).toBeEnabled({
        timeout: 5_000,
      })
    },
  )
})
