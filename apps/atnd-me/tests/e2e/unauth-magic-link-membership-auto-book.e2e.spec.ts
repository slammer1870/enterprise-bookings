/**
 * Unauth Magic Link → Membership Auto-Booking
 *
 * Requirement:
 *   An unauthenticated user lands on the public schedule and clicks "Book" on a timeslot
 *   that has BOTH drop-in AND membership payment methods. Because they are not signed in
 *   the schedule redirects them to /complete-booking. They enter their email, receive a
 *   magic link, click it, and the Better Auth callback brings them to /bookings/[id].
 *
 *   Because the user has an active membership plan that covers the timeslot, the server
 *   detects the entitlement during page render (validateAndAttemptCheckIn) and automatically
 *   creates the booking with that subscription, then redirects straight to /success —
 *   the user NEVER has to interact with the /bookings/[id] UI at all.
 */

import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  createTestPlan,
  createTestSubscription,
  updateTenantStripeConnect,
  getPayloadInstance,
} from './helpers/data-helpers'
import { clearTestMagicLinks, pollForTestMagicLink } from '@repo/testing-config/src/playwright'
import { advanceScheduleToDate, ensureTenant1ActiveBranchesOnly } from './helpers/schedule-helpers'
import { uniqueClassName } from '@repo/testing-config/src/playwright'
import { e2eSlowTestTimeout } from './helpers/timeouts'

test.describe('Unauth magic link booking with active membership', () => {
  test.setTimeout(e2eSlowTestTimeout(240_000, 180_000))

  test.beforeAll(async ({ testData }) => {
    await ensureTenant1ActiveBranchesOnly(testData)
  })

  test(
    'unauthenticated user is prompted to log in, receives magic link, and is auto-booked via active membership without touching /bookings/[id] UI',
    async ({ page, request, testData }) => {
      const tenant = testData.tenants[0]!
      const user = testData.users.user1
      const w = testData.workerIndex

      if (!tenant?.id || !tenant.slug || !user?.email) {
        throw new Error('Expected tenant and user fixtures')
      }

      // Tenant needs Stripe Connect active so drop-in payment method is valid
      await updateTenantStripeConnect(tenant.id, {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: `acct_e2e_ml_mem_${w}_${Date.now()}`,
      })

      // ── Data setup ────────────────────────────────────────────────────────────

      const plan = await createTestPlan({
        tenantId: tenant.id,
        name: `E2E ML Membership Plan w${w} ${Date.now()}`,
        sessions: 8,
        allowMultipleBookingsPerTimeslot: false,
        stripeProductId: `prod_e2e_ml_mem_${w}_${Date.now()}`,
        priceId: `price_e2e_ml_mem_${w}_${Date.now()}`,
      })

      const className = uniqueClassName(`E2E ML Membership Book ${tenant.id}`)
      const eventType = await createTestEventType(
        tenant.id,
        className,
        10,
        'Magic link membership booking',
        w,
      )
      const scheduleTitle = `${className} ${tenant.id}${w > 0 ? ` w${w}` : ''}`

      // Attach both drop-in AND membership payment methods to the event type in one update
      // so both tabs are visible on the booking page.
      const payload = await getPayloadInstance()
      const dropIn = (await payload.create({
        collection: 'drop-ins',
        data: {
          name: `E2E ML Drop-in ${tenant.id}-w${w}-${Date.now()}`,
          isActive: true,
          price: 12,
          adjustable: false,
          maxBookingsPerTimeslot: 1,
          tenant: tenant.id,
        },
        overrideAccess: true,
      })) as { id: number }

      await payload.update({
        collection: 'event-types',
        id: eventType.id,
        data: {
          paymentMethods: {
            allowedDropIn: dropIn.id,
            allowedPlans: [plan.id],
          },
        },
        overrideAccess: true,
      })

      // Active subscription for the booking user
      await createTestSubscription({
        userId: user.id,
        tenantId: tenant.id,
        planId: plan.id,
        status: 'active',
        stripeSubscriptionId: null,
        stripeCustomerId: null,
        stripeAccountId: null,
      })

      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 5 + w)
      startTime.setHours(14, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(15, 0, 0, 0)

      const timeslot = await createTestTimeslot(
        tenant.id,
        eventType.id,
        startTime,
        endTime,
        undefined,
        true,
      )

      // ── Step 1: Visit the schedule as an unauthenticated user ─────────────────

      await page.context().clearCookies()
      await page.evaluate(() => {
        try {
          localStorage.clear()
          sessionStorage.clear()
        } catch {
          // ignore
        }
      })
      await page.goto('about:blank')

      await navigateToTenant(page, tenant.slug, '/')
      await expect(page.getByRole('heading', { name: /^schedule$/i })).toBeVisible({
        timeout: 20_000,
      })

      await advanceScheduleToDate(page, startTime)

      // ── Step 2: Click "Book" — unauth triggers loginToBook → /complete-booking ─

      const lessonTitle = page.getByText(scheduleTitle, { exact: true }).first()
      await expect(lessonTitle).toBeVisible({ timeout: 20_000 })

      const lessonRow = lessonTitle
        .locator('xpath=ancestor::div[contains(@class,"border-b")]')
        .first()
      const bookBtn = lessonRow.getByRole('button', { name: /^book$/i })
      await expect(bookBtn).toBeVisible({ timeout: 10_000 })
      await expect(bookBtn).toBeEnabled()

      await bookBtn.click()
      await expect(page).toHaveURL(/\/complete-booking/, { timeout: 30_000 })

      // ── Step 3: Enter email address and request magic link ────────────────────

      await expect(
        page.getByText('Log in to your account', { exact: true }),
      ).toBeVisible({ timeout: 20_000 })

      const emailInput = page
        .getByRole('textbox', { name: /email/i })
        .or(page.getByPlaceholder(/your email/i))
        .first()

      await clearTestMagicLinks(request, user.email)
      await emailInput.fill(user.email)
      await page.getByRole('button', { name: /^submit$/i }).click()

      await expect(
        page.getByRole('heading', { name: /^magic link sent$/i }),
      ).toBeVisible({ timeout: 30_000 })

      // ── Step 4: Retrieve magic link from test endpoint and navigate to it ─────

      const magicLink = await pollForTestMagicLink(request, user.email)
      await page.goto(magicLink.url, { waitUntil: 'domcontentloaded' })

      // ── Step 5: Magic link callback → /bookings/[id] → auto-booked → /success ──
      //
      // The server detects the active subscription while rendering /bookings/[id] and
      // redirects immediately to /success without the user interacting with the page at all.

      await page.waitForURL(
        (url) => url.pathname === '/success',
        { timeout: 60_000 },
      )

      // ── Step 9: Confirm booking persisted in DB ───────────────────────────────

      await expect
        .poll(
          async () => {
            const bookings = await payload.find({
              collection: 'bookings',
              where: {
                and: [
                  { timeslot: { equals: timeslot.id } },
                  { user: { equals: user.id } },
                  { status: { equals: 'confirmed' } },
                ],
              },
              depth: 0,
              overrideAccess: true,
            })
            return bookings.docs.length
          },
          { timeout: 15_000 },
        )
        .toBeGreaterThan(0)
    },
  )

  test(
    'when membership allows multiple bookings per timeslot, user lands on /bookings/[id] to select quantity and confirms via Membership tab',
    async ({ page, request, testData }) => {
      const tenant = testData.tenants[0]!
      const user = testData.users.user1
      const w = testData.workerIndex

      if (!tenant?.id || !tenant.slug || !user?.email) {
        throw new Error('Expected tenant and user fixtures')
      }

      await updateTenantStripeConnect(tenant.id, {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: `acct_e2e_ml_multi_${w}_${Date.now()}`,
      })

      // ── Data setup ────────────────────────────────────────────────────────────
      //
      // allowMultipleBookingsPerTimeslot: true maps to maxBookingsPerTimeslot: null.
      // validateAndAttemptCheckIn sees planMaxPerTimeslot !== 1 and returns
      // bookedImmediately: false so the booking page renders for quantity selection.

      const payload = await getPayloadInstance()

      const plan = await createTestPlan({
        tenantId: tenant.id,
        name: `E2E ML Multi-Booking Plan w${w} ${Date.now()}`,
        sessions: 8,
        allowMultipleBookingsPerTimeslot: true,
        stripeProductId: `prod_e2e_ml_multi_${w}_${Date.now()}`,
        priceId: `price_e2e_ml_multi_${w}_${Date.now()}`,
      })

      const className = uniqueClassName(`E2E ML Multi Book ${tenant.id}`)
      const eventType = await createTestEventType(
        tenant.id,
        className,
        10,
        'Magic link multi-booking membership',
        w,
      )
      const scheduleTitle = `${className} ${tenant.id}${w > 0 ? ` w${w}` : ''}`

      const dropIn = (await payload.create({
        collection: 'drop-ins',
        data: {
          name: `E2E ML Multi Drop-in ${tenant.id}-w${w}-${Date.now()}`,
          isActive: true,
          price: 12,
          adjustable: false,
          maxBookingsPerTimeslot: 1,
          tenant: tenant.id,
        },
        overrideAccess: true,
      })) as { id: number }

      await payload.update({
        collection: 'event-types',
        id: eventType.id,
        data: {
          paymentMethods: {
            allowedDropIn: dropIn.id,
            allowedPlans: [plan.id],
          },
        },
        overrideAccess: true,
      })

      await createTestSubscription({
        userId: user.id,
        tenantId: tenant.id,
        planId: plan.id,
        status: 'active',
        stripeSubscriptionId: null,
        stripeCustomerId: null,
        stripeAccountId: null,
      })

      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 6 + w)
      startTime.setHours(10, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(11, 0, 0, 0)

      const timeslot = await createTestTimeslot(
        tenant.id,
        eventType.id,
        startTime,
        endTime,
        undefined,
        true,
      )

      // ── Step 1: Visit the schedule as an unauthenticated user ─────────────────

      await page.context().clearCookies()
      await page.evaluate(() => {
        try {
          localStorage.clear()
          sessionStorage.clear()
        } catch {
          // ignore
        }
      })
      await page.goto('about:blank')

      await navigateToTenant(page, tenant.slug, '/')
      await expect(page.getByRole('heading', { name: /^schedule$/i })).toBeVisible({
        timeout: 20_000,
      })

      await advanceScheduleToDate(page, startTime)

      // ── Step 2: Click "Book" — unauth triggers loginToBook → /complete-booking ─

      const lessonTitle = page.getByText(scheduleTitle, { exact: true }).first()
      await expect(lessonTitle).toBeVisible({ timeout: 20_000 })

      const lessonRow = lessonTitle
        .locator('xpath=ancestor::div[contains(@class,"border-b")]')
        .first()
      const bookBtn = lessonRow.getByRole('button', { name: /^book$/i })
      await expect(bookBtn).toBeVisible({ timeout: 10_000 })
      await expect(bookBtn).toBeEnabled()

      await bookBtn.click()
      await expect(page).toHaveURL(/\/complete-booking/, { timeout: 30_000 })

      // ── Step 3: Enter email address and request magic link ────────────────────

      await expect(
        page.getByText('Log in to your account', { exact: true }),
      ).toBeVisible({ timeout: 20_000 })

      const emailInput = page
        .getByRole('textbox', { name: /email/i })
        .or(page.getByPlaceholder(/your email/i))
        .first()

      await clearTestMagicLinks(request, user.email)
      await emailInput.fill(user.email)
      await page.getByRole('button', { name: /^submit$/i }).click()

      await expect(
        page.getByRole('heading', { name: /^magic link sent$/i }),
      ).toBeVisible({ timeout: 30_000 })

      // ── Step 4: Retrieve magic link and navigate to it ────────────────────────

      const magicLink = await pollForTestMagicLink(request, user.email)
      await page.goto(magicLink.url, { waitUntil: 'domcontentloaded' })

      // ── Step 5: Magic link callback → /bookings/[id] renders (no auto-redirect) ─
      //
      // The plan has maxBookingsPerTimeslot: null (unlimited), so validateAndAttemptCheckIn
      // returns bookedImmediately: false and the booking page renders for quantity selection.

      await page.waitForURL(
        (url) => url.pathname === `/bookings/${timeslot.id}`,
        { timeout: 60_000 },
      )

      // ── Step 6: Select Membership tab and confirm ─────────────────────────────

      const membershipTab = page.getByRole('tab', { name: /membership/i })
      await expect(membershipTab).toBeVisible({ timeout: 20_000 })
      await membershipTab.click()

      const useMembershipBtn = page.getByRole('button', { name: /use my membership/i })
      await expect(useMembershipBtn).toBeVisible({ timeout: 15_000 })
      await expect(useMembershipBtn).toBeEnabled()

      const createBookingsResponse = page.waitForResponse(
        (r) =>
          r.url().includes('bookings.createBookings') &&
          r.request().method() === 'POST' &&
          r.status() === 200,
        { timeout: 30_000 },
      )
      await Promise.all([createBookingsResponse, useMembershipBtn.click()])

      // ── Step 7: Verify redirect to /success ───────────────────────────────────

      await page.waitForURL((url) => url.pathname === '/success', { timeout: 30_000 })

      // ── Step 8: Confirm booking persisted in DB ───────────────────────────────

      await expect
        .poll(
          async () => {
            const bookings = await payload.find({
              collection: 'bookings',
              where: {
                and: [
                  { timeslot: { equals: timeslot.id } },
                  { user: { equals: user.id } },
                  { status: { equals: 'confirmed' } },
                ],
              },
              depth: 0,
              overrideAccess: true,
            })
            return bookings.docs.length
          },
          { timeout: 15_000 },
        )
        .toBeGreaterThan(0)
    },
  )
})
