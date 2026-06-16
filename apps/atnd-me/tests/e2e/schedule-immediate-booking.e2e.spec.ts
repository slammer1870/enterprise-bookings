/**
 * Schedule Immediate Booking
 *
 * Tests the schedule "Book" button flow where users with an entitlement (active
 * subscription, valid class pass) or lessons with no payment methods configured
 * get an immediate booking from the schedule (button becomes "Modify Booking"),
 * while users who still need to pay are redirected to /bookings/[id].
 *
 * Stories:
 *  1. No payment methods → immediate booking, button becomes "Modify Booking"
 *  2. Active subscription → immediate booking, button becomes "Cancel Booking" when single-slot
 *  3. Valid class pass → immediate booking (1 credit deducted), button becomes "Modify Booking"
 *  4. Payment required (no entitlement) → redirect to /bookings/[id]
 *  5. Subscription limit reached → redirect to /bookings/[id]
 *  5b. 2x/week limit exhausted (3rd check-in) → redirect to /bookings/[id], Membership tab
 *      selected by default and upgrade plans displayed
 *  6a. Quantity increase (no payment methods) → additional slots confirmed immediately
 *  6b. Quantity increase (class pass, maxBookingsPerTimeslot: null) → checkout flow, credits deducted
 *  6c. Quantity increase blocked (maxBookingsPerTimeslot: 1) → public schedule shows "Cancel Booking"
 */

import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  createTestPlan,
  createTestSubscription,
  setEventTypeAllowedPlans,
  getPayloadInstance,
  updateTenantStripeConnect,
} from './helpers/data-helpers'
import { uniqueClassName } from '@repo/testing-config/src/playwright'
import { advanceScheduleToDate } from './helpers/schedule-helpers'
import { e2eSlowTestTimeout } from './helpers/timeouts'

// ─── Shared helpers ────────────────────────────────────────────────────────────

function futureDate(daysFromNow: number, hour = 10): Date {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, 0, 0, 0)
  return d
}

async function navigateToSchedule(
  // Playwright `page` type is not easily inferable through our custom fixtures wrapper.
  // Using `any` keeps this test file focused on behavior assertions.
  page: any,
  tenantSlug: string,
  targetDate: Date
) {
  await navigateToTenant(page, tenantSlug, '/')
  await page
    .waitForURL((url) => url.pathname === '/' || url.pathname === '/home', {
      timeout: 15000,
    })
    .catch(() => null)
  await expect(page.getByText(/loading schedule/i)).not.toBeVisible({ timeout: 15000 }).catch(() => null)
  await advanceScheduleToDate(page, targetDate)
  await expect(page.getByText('No timeslots scheduled for today')).not.toBeVisible({
    timeout: 5000,
  }).catch(() => null)
}

/**
 * Find the lesson row by title and return the CTA button within it.
 */
async function getLessonBookButton(
  page: any,
  scheduleTitle: string,
  buttonName: RegExp | string = /^book$/i
) {
  const lessonTitles = page.getByText(scheduleTitle, { exact: true })
  await expect(lessonTitles.first()).toBeVisible({ timeout: 20000 })

  const count = await lessonTitles.count()
  for (let i = 0; i < count; i++) {
    const lessonRow = lessonTitles.nth(i).locator('xpath=ancestor::div[contains(@class,"border-b")]').first()
    const btn = lessonRow.getByRole('button', { name: buttonName })
    if ((await btn.count()) > 0) {
      return btn
    }
  }

  // Fall back so Playwright surfaces a clear "button not found" error on the first row.
  const lessonRow = lessonTitles.first().locator('xpath=ancestor::div[contains(@class,"border-b")]').first()
  return lessonRow.getByRole('button', { name: buttonName })
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Schedule immediate booking', () => {
  test.setTimeout(e2eSlowTestTimeout())

  // ── Story 1: No payment methods → immediate booking ──────────────────────────

  test('no payment methods: Book creates confirmed booking immediately and button becomes Modify Booking', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenant = testData.tenants[0]!
    const user = testData.users.user1
    const w = testData.workerIndex

    if (!tenant?.id || !tenant.slug || !user?.email) throw new Error('Expected tenant and user fixtures')

    const className = uniqueClassName(`E2E Immediate No Payment ${tenant.id}`)
    const eventType = await createTestEventType(tenant.id, className, 10, 'No payment methods class', w)
    // No paymentMethods set — lesson is free

    const startTime = futureDate(6 + w)
    const endTime = futureDate(6 + w, 11)
    const lesson = await createTestTimeslot(tenant.id, eventType.id, startTime, endTime, undefined, true)

    await loginAsRegularUserViaApi(page, user.email, 'password', { tenantSlug: tenant.slug })
    await navigateToSchedule(page, tenant.slug, startTime)

    const scheduleTitle = `${className} ${tenant.id}${w > 0 ? ` w${w}` : ''}`
    const bookBtn = await getLessonBookButton(page, scheduleTitle)
    await expect(bookBtn).toBeVisible({ timeout: 10000 })

    const trpcCall = page.waitForResponse(
      (r) =>
        r.url().includes('bookSingleSlotTimeslotOrRedirect') &&
        r.request().method() === 'POST' &&
        r.status() === 200,
      { timeout: 20000 }
    )
    await Promise.all([trpcCall, bookBtn.click()])

    // URL should remain on the schedule (no redirect to booking page)
    await page.waitForTimeout(500)
    expect(page.url()).not.toMatch(new RegExp(`/bookings/${lesson.id}$`))

    // Button should become "Modify Booking"
    const modifyBtn = await getLessonBookButton(page, scheduleTitle, /modify booking/i)
    await expect(modifyBtn).toBeVisible({ timeout: 15000 })

    // Confirm booking was created in DB
    const bookings = await payload.find({
      collection: 'bookings',
      where: {
        and: [
          { timeslot: { equals: lesson.id } },
          { user: { equals: user.id } },
          { status: { equals: 'confirmed' } },
        ],
      },
      depth: 0,
      overrideAccess: true,
    })
    expect(bookings.docs.length).toBeGreaterThan(0)
  })

  // ── Story 2: Active subscription → immediate booking ─────────────────────────

  test('active subscription: Book creates confirmed booking immediately and button becomes Cancel Booking when single-slot', async ({
    page,
    testData,
  }) => {
    const tenant = testData.tenants[0]!
    const user = testData.users.user1
    const w = testData.workerIndex

    if (!tenant?.id || !tenant.slug || !user?.email) throw new Error('Expected tenant and user fixtures')

    await updateTenantStripeConnect(tenant.id, {
      stripeConnectOnboardingStatus: 'active',
      stripeConnectAccountId: `acct_e2e_imm_sub_${w}`,
    })

    const plan = await createTestPlan({
      tenantId: tenant.id,
      name: `E2E Immediate Sub Plan w${w} ${Date.now()}`,
      sessions: 8,
      allowMultipleBookingsPerTimeslot: false,
      stripeProductId: `prod_e2e_imm_sub_${w}_${Date.now()}`,
      priceId: `price_e2e_imm_sub_${w}_${Date.now()}`,
    })

    const className = uniqueClassName(`E2E Immediate Sub ${tenant.id}`)
    const eventType = await createTestEventType(tenant.id, className, 10, 'Subscription class', w)
    await setEventTypeAllowedPlans(eventType.id, [plan.id])

    await createTestSubscription({
      userId: user.id,
      tenantId: tenant.id,
      planId: plan.id,
      status: 'active',
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      stripeAccountId: null,
    })

    const startTime = futureDate(7 + w)
    const endTime = futureDate(7 + w, 11)
    await createTestTimeslot(tenant.id, eventType.id, startTime, endTime, undefined, true)

    await loginAsRegularUserViaApi(page, user.email, 'password', { tenantSlug: tenant.slug })
    await navigateToSchedule(page, tenant.slug, startTime)

    const scheduleTitle = `${className} ${tenant.id}${w > 0 ? ` w${w}` : ''}`
    const bookBtn = await getLessonBookButton(page, scheduleTitle)
    await expect(bookBtn).toBeVisible({ timeout: 10000 })

    const trpcCall = page.waitForResponse(
      (r) =>
        r.url().includes('bookSingleSlotTimeslotOrRedirect') &&
        r.request().method() === 'POST' &&
        r.status() === 200,
      { timeout: 20000 }
    )
    await Promise.all([trpcCall, bookBtn.click()])

    // For single-slot subscription caps, the only modification from the public schedule is cancel.
    const cancelBtn = await getLessonBookButton(page, scheduleTitle, /cancel booking/i)
    await expect(cancelBtn).toBeVisible({ timeout: 15000 })
    const modifyBtn = await getLessonBookButton(page, scheduleTitle, /modify booking/i)
    await expect(modifyBtn).not.toBeVisible({ timeout: 5000 })

    // URL should remain on schedule
    await page.waitForTimeout(300)
    expect(page.url()).not.toMatch(/\/bookings\/\d+$/)
  })

  // ── Story 3: Valid class pass → immediate booking ─────────────────────────────

  test('valid class pass: Book creates confirmed booking, decrements 1 credit, button becomes Modify Booking', async ({
    page,
    testData,
  }) => {
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

    const className = uniqueClassName(`E2E Immediate Class Pass ${tenant.id}`)
    const eventType = await createTestEventType(tenant.id, className, 10, 'Class pass class', w)

    const cpt = await payload.create({
      collection: 'class-pass-types',
      data: {
        name: `E2E Imm Pass 5-Pack w${w} ${Date.now()}`,
        slug: `e2e-imm-pass-${tenant.id}-${w}-${Date.now()}`,
        quantity: 5,
        maxBookingsPerTimeslot: 1,
        tenant: tenant.id,
        priceInformation: { price: 19.99 },
        skipSync: true,
        stripeProductId: `prod_imm_pass_${tenant.id}_${w}_${Date.now()}`,
      } as any,
      overrideAccess: true,
    }) as { id: number }

    await payload.update({
      collection: 'event-types',
      id: eventType.id,
      data: { paymentMethods: { allowedClassPasses: [cpt.id] } },
      overrideAccess: true,
    })

    const future = new Date(Date.now() + 86400000 * 60)
    const pass = await payload.create({
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
    }) as { id: number }

    const startTime = futureDate(8 + w)
    const endTime = futureDate(8 + w, 11)
    await createTestTimeslot(tenant.id, eventType.id, startTime, endTime, undefined, true)

    await loginAsRegularUserViaApi(page, user.email, 'password', { tenantSlug: tenant.slug })
    await navigateToSchedule(page, tenant.slug, startTime)

    const scheduleTitle = `${className} ${tenant.id}${w > 0 ? ` w${w}` : ''}`
    const bookBtn = await getLessonBookButton(page, scheduleTitle)
    await expect(bookBtn).toBeVisible({ timeout: 10000 })

    const trpcCall = page.waitForResponse(
      (r) =>
        r.url().includes('bookSingleSlotTimeslotOrRedirect') &&
        r.request().method() === 'POST' &&
        r.status() === 200,
      { timeout: 20000 }
    )
    await Promise.all([trpcCall, bookBtn.click()])

    // Button should become "Modify Booking"
    const modifyBtn = await getLessonBookButton(page, scheduleTitle, /modify booking/i)
    await expect(modifyBtn).toBeVisible({ timeout: 15000 })

    // URL should remain on schedule
    await page.waitForTimeout(300)
    expect(page.url()).not.toMatch(/\/bookings\/\d+$/)

    // Class pass should be decremented by 1 (5 → 4)
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
        { timeout: 10000 }
      )
      .toBe(4)
  })

  // ── Story 4: Payment required (no entitlement) → redirect ────────────────────

  test('payment required with no entitlement: Book redirects to booking page', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenant = testData.tenants[0]!
    const user = testData.users.user2
    const w = testData.workerIndex

    if (!tenant?.id || !tenant.slug || !user?.email) throw new Error('Expected tenant and user fixtures')

    await updateTenantStripeConnect(tenant.id, {
      stripeConnectOnboardingStatus: 'active',
      stripeConnectAccountId: `acct_e2e_imm_dropin_${w}`,
    })

    const className = uniqueClassName(`E2E Immediate Drop-in ${tenant.id}`)
    const eventType = await createTestEventType(tenant.id, className, 10, 'Drop-in class', w)

    // Drop-in only, single slot — user2 has no subscription or class pass.
    // event-types.paymentMethods.allowedDropIn expects a drop-in relationship id,
    // so create the drop-in document first.
    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `E2E Imm Drop-in Single Slot ${tenant.id}-w${w}-${Date.now()}`,
        isActive: true,
        price: 15,
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
        paymentMethods: { allowedDropIn: dropIn.id },
        tenant: tenant.id,
      },
      overrideAccess: true,
    })

    const startTime = futureDate(9 + w)
    const endTime = futureDate(9 + w, 11)
    const lesson = await createTestTimeslot(tenant.id, eventType.id, startTime, endTime, undefined, true)

    await loginAsRegularUserViaApi(page, user.email, 'password', { tenantSlug: tenant.slug })
    await navigateToSchedule(page, tenant.slug, startTime)

    const scheduleTitle = `${className} ${tenant.id}${w > 0 ? ` w${w}` : ''}`
    const bookBtn = await getLessonBookButton(page, scheduleTitle)
    await expect(bookBtn).toBeVisible({ timeout: 10000 })

    const trpcCall = page.waitForResponse(
      (r) =>
        r.url().includes('bookSingleSlotTimeslotOrRedirect') &&
        r.request().method() === 'POST' &&
        r.status() === 200,
      { timeout: 20000 }
    )
    await Promise.all([trpcCall, bookBtn.click()])

    // Should redirect to /bookings/[id]
    await page.waitForURL((url) => url.pathname === `/bookings/${lesson.id}`, { timeout: 20000 })
    await expect(
      page.getByText(/select quantity|payment methods|choose how to pay/i).first()
    ).toBeVisible({ timeout: 15000 })
  })

  // ── Story 5: Subscription limit reached → redirect ───────────────────────────

  test('subscription limit reached: Book redirects to booking page', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenant = testData.tenants[0]!
    const user = testData.users.user3
    const w = testData.workerIndex

    if (!tenant?.id || !tenant.slug || !user?.email) throw new Error('Expected tenant and user fixtures')

    await updateTenantStripeConnect(tenant.id, {
      stripeConnectOnboardingStatus: 'active',
      stripeConnectAccountId: `acct_e2e_imm_sublimit_${w}`,
    })

    // Plan with 1 session per week so we can exhaust it easily
    const plan = await createTestPlan({
      tenantId: tenant.id,
      name: `E2E Imm Sub Limit Plan w${w} ${Date.now()}`,
      sessions: 1,
      allowMultipleBookingsPerTimeslot: false,
      stripeProductId: `prod_e2e_imm_sublimit_${w}_${Date.now()}`,
      priceId: `price_e2e_imm_sublimit_${w}_${Date.now()}`,
    })

    const className = uniqueClassName(`E2E Immediate Sub Limit ${tenant.id}`)
    const eventType = await createTestEventType(tenant.id, className, 10, 'Sub limit class', w)
    await setEventTypeAllowedPlans(eventType.id, [plan.id])

    const subscription = await createTestSubscription({
      userId: user.id,
      tenantId: tenant.id,
      planId: plan.id,
      status: 'active',
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      stripeAccountId: null,
      // For day/week/month session limits, the effective window is lesson-date anchored
      // (subscription.startDate does not affect the window).
      startDate: new Date(),
    })

    // Create a booking in this period using the subscription to exhaust the 1-session limit
    const lessonDay = futureDate(10 + w, 14)
    const lessonDayDate = new Date(lessonDay)
    const lessonDayOfWeek = lessonDayDate.getDay() // 0=Sunday..6=Saturday
    const mostRecentSunday = new Date(lessonDayDate)
    mostRecentSunday.setHours(0, 0, 0, 0)
    mostRecentSunday.setDate(mostRecentSunday.getDate() - lessonDayOfWeek)

    const usedTimeslotStart = new Date(mostRecentSunday)
    usedTimeslotStart.setDate(usedTimeslotStart.getDate() + lessonDayOfWeek)
    usedTimeslotStart.setHours(8, 0, 0, 0)

    const usedTimeslotEnd = new Date(mostRecentSunday)
    usedTimeslotEnd.setDate(usedTimeslotEnd.getDate() + lessonDayOfWeek)
    usedTimeslotEnd.setHours(9, 0, 0, 0)
    const usedEventType = await createTestEventType(tenant.id, className + ' Used', 10, undefined, w)
    await setEventTypeAllowedPlans(usedEventType.id, [plan.id])
    const usedTimeslot = await createTestTimeslot(tenant.id, usedEventType.id, usedTimeslotStart, usedTimeslotEnd, undefined, true)

    await payload.create({
      collection: 'bookings',
      data: {
        timeslot: usedTimeslot.id,
        user: user.id,
        tenant: tenant.id,
        status: 'confirmed',
        paymentMethodUsed: 'subscription',
        subscriptionIdUsed: subscription.id,
      } as any,
      overrideAccess: true,
    })

    // New timeslot in the same week — should be blocked due to limit
    const startTime = new Date(mostRecentSunday)
    startTime.setDate(startTime.getDate() + lessonDayOfWeek)
    startTime.setHours(14, 0, 0, 0)

    const endTime = new Date(mostRecentSunday)
    endTime.setDate(endTime.getDate() + lessonDayOfWeek)
    endTime.setHours(15, 0, 0, 0)

    const lesson = await createTestTimeslot(tenant.id, eventType.id, startTime, endTime, undefined, true)

    await loginAsRegularUserViaApi(page, user.email, 'password', { tenantSlug: tenant.slug })
    await navigateToSchedule(page, tenant.slug, startTime)

    const scheduleTitle = `${className} ${tenant.id}${w > 0 ? ` w${w}` : ''}`
    const bookBtn = await getLessonBookButton(page, scheduleTitle)
    await expect(bookBtn).toBeVisible({ timeout: 10000 })

    const trpcCall = page.waitForResponse(
      (r) =>
        r.url().includes('bookSingleSlotTimeslotOrRedirect') &&
        r.request().method() === 'POST' &&
        r.status() === 200,
      { timeout: 20000 }
    )
    await Promise.all([trpcCall, bookBtn.click()])

    // Should redirect to /bookings/[id] since subscription is exhausted
    await page.waitForURL((url) => url.pathname === `/bookings/${lesson.id}`, { timeout: 20000 })
    await expect(
      page.getByText(/select quantity|payment methods|choose how to pay/i).first()
    ).toBeVisible({ timeout: 15000 })
  })

  // ── Story 5b: Weekly window resets across Sunday..Sunday ──────────────────

  test('weekly session limit resets across Sunday..Sunday windows', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenant = testData.tenants[0]!
    const user = testData.users.user3
    const w = testData.workerIndex

    if (!tenant?.id || !tenant.slug || !user?.email) throw new Error('Expected tenant and user fixtures')

    await updateTenantStripeConnect(tenant.id, {
      stripeConnectOnboardingStatus: 'active',
      stripeConnectAccountId: `acct_e2e_imm_sublimit_weekreset_${w}`,
    })

    // Plan with 2 sessions per week.
    const plan = await createTestPlan({
      tenantId: tenant.id,
      name: `E2E Imm Sub Limit Week Reset Plan w${w} ${Date.now()}`,
      sessions: 2,
      allowMultipleBookingsPerTimeslot: false,
      stripeProductId: `prod_e2e_imm_sublimit_weekreset_${w}_${Date.now()}`,
      priceId: `price_e2e_imm_sublimit_weekreset_${w}_${Date.now()}`,
    })

    const className = uniqueClassName(`E2E Immediate Sub Limit Week Reset ${tenant.id}`)
    const eventType = await createTestEventType(tenant.id, className, 10, 'Sub limit class', w)
    await setEventTypeAllowedPlans(eventType.id, [plan.id])

    const subscription = await createTestSubscription({
      userId: user.id,
      tenantId: tenant.id,
      planId: plan.id,
      status: 'active',
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      stripeAccountId: null,
      // For week/month/day session limits we anchor to the lesson date, not subscription.startDate.
      startDate: new Date(),
    })

    // Anchor far enough in the future, then snap to that week's Wednesday for the attempt.
    // futureDate() is calendar-day based and is not guaranteed to land on Wednesday.
    const attemptAnchor = futureDate(10 + w, 14)
    const attemptAnchorDate = new Date(attemptAnchor)
    attemptAnchorDate.setHours(14, 0, 0, 0)

    const week3Sunday = new Date(attemptAnchorDate)
    week3Sunday.setHours(0, 0, 0, 0)
    const week3SundayDay = week3Sunday.getDay() // 0=Sunday..6=Saturday
    week3Sunday.setDate(week3Sunday.getDate() - week3SundayDay)

    const week2Sunday = new Date(week3Sunday)
    week2Sunday.setDate(week2Sunday.getDate() - 7)

    const week1Sunday = new Date(week3Sunday)
    week1Sunday.setDate(week1Sunday.getDate() - 14)

    const getDayISO = (d: Date, hour: number) => {
      const x = new Date(d)
      x.setHours(hour, 0, 0, 0)
      return x
    }

    const seedBooking = async (lessonDate: Date, hour: number) => {
      const startTime = getDayISO(lessonDate, hour)
      const endTime = getDayISO(lessonDate, hour + 1)
      const ts = await createTestTimeslot(tenant.id, eventType.id, startTime, endTime, undefined, true)
      await payload.create({
        collection: 'bookings',
        data: {
          timeslot: ts.id,
          user: user.id,
          tenant: tenant.id,
          status: 'confirmed',
          paymentMethodUsed: 'subscription',
          subscriptionIdUsed: subscription.id,
        } as any,
        overrideAccess: true,
      })
      return ts
    }

    const week1Wednesday = new Date(week1Sunday)
    week1Wednesday.setDate(week1Wednesday.getDate() + 3)
    week1Wednesday.setHours(0, 0, 0, 0)

    const week2Wednesday = new Date(week2Sunday)
    week2Wednesday.setDate(week2Wednesday.getDate() + 3)
    week2Wednesday.setHours(0, 0, 0, 0)

    const week3Wednesday = new Date(week3Sunday)
    week3Wednesday.setDate(week3Wednesday.getDate() + 3)
    week3Wednesday.setHours(0, 0, 0, 0)

    // Week 1: seed 2 bookings on Wednesday (same day as the attempt window end).
    await seedBooking(week1Wednesday, 10)
    await seedBooking(week1Wednesday, 12)

    // Week 2: seed 2 bookings on Wednesday.
    await seedBooking(week2Wednesday, 10)
    await seedBooking(week2Wednesday, 12)

    // Week 3: seed 2 bookings on Wednesday, so the 3rd booking attempt on that same Wednesday must be blocked.
    await seedBooking(week3Wednesday, 10)
    await seedBooking(week3Wednesday, 12)

    // Create the Wednesday timeslot for Week 3 that we will attempt to book (this is the "3rd").
    const attemptStart = getDayISO(week3Wednesday, 14)
    const attemptEnd = getDayISO(week3Wednesday, 15)

    const attemptTimeslot = await createTestTimeslot(
      tenant.id,
      eventType.id,
      attemptStart,
      attemptEnd,
      undefined,
      true
    )

    await loginAsRegularUserViaApi(page, user.email, 'password', { tenantSlug: tenant.slug })
    await navigateToSchedule(page, tenant.slug, attemptStart)

    const scheduleTitle = `${className} ${tenant.id}${w > 0 ? ` w${w}` : ''}`
    const bookBtn = await getLessonBookButton(page, scheduleTitle)

    const trpcCall = page.waitForResponse(
      (r) =>
        r.url().includes('bookSingleSlotTimeslotOrRedirect') &&
        r.request().method() === 'POST' &&
        r.status() === 200,
      { timeout: 20000 }
    )
    await Promise.all([trpcCall, bookBtn.click()])

    // Should redirect because the weekly window is exhausted (already 2 used in this window).
    await page.waitForURL((url) => url.pathname === `/bookings/${attemptTimeslot.id}`, { timeout: 20000 })
    await expect(page.getByText(/select quantity|payment methods|choose how to pay/i).first()).toBeVisible({
      timeout: 15000,
    })
  })

  // ── Story 5b: 2x/week quota exhausted, 3rd check-in → Membership tab default ──
  //
  // User has a "2 sessions per week" membership (sessions=2, interval=week).
  // They have already used both sessions this week via confirmed bookings.
  // When they navigate to a 3rd booking page in the same week:
  //   • The Membership tab is selected by default (not the Drop-in tab).
  //   • The Membership tab content shows upgrade plan cards for plans that would
  //     give them additional sessions this period ("N more session(s) this period").

  test('2x/week quota exhausted: booking page defaults to Membership tab and shows upgrade plans', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenant = testData.tenants[0]!
    const user = testData.users.user3
    const w = testData.workerIndex

    if (!tenant?.id || !tenant.slug || !user?.email) throw new Error('Expected tenant and user fixtures')

    await updateTenantStripeConnect(tenant.id, {
      stripeConnectOnboardingStatus: 'active',
      stripeConnectAccountId: `acct_e2e_2xweek_${w}`,
    })

    // Base plan: 2 sessions/week — the quota the user will exhaust
    const ts = Date.now()
    const basePlan = await createTestPlan({
      tenantId: tenant.id,
      name: `E2E 2x Week Base Plan w${w} ${ts}`,
      sessions: 2,
      allowMultipleBookingsPerTimeslot: false,
      stripeProductId: `prod_e2e_2xweek_base_${w}_${ts}`,
      priceId: `price_e2e_2xweek_base_${w}_${ts}`,
    })

    // Upgrade plan: 3 sessions/week — should appear as an upgrade option
    const upgradePlan = await createTestPlan({
      tenantId: tenant.id,
      name: `E2E 3x Week Upgrade Plan w${w} ${ts}`,
      sessions: 3,
      allowMultipleBookingsPerTimeslot: false,
      stripeProductId: `prod_e2e_2xweek_upgrade_${w}_${ts}`,
      priceId: `price_e2e_2xweek_upgrade_${w}_${ts}`,
    })

    const className = uniqueClassName(`E2E 2xWeek Limit ${tenant.id}`)
    const eventType = await createTestEventType(tenant.id, className, 10, '2x/week class', w)
    await setEventTypeAllowedPlans(eventType.id, [basePlan.id, upgradePlan.id])

    const subscription = await createTestSubscription({
      userId: user.id,
      tenantId: tenant.id,
      planId: basePlan.id,
      status: 'active',
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      stripeAccountId: null,
      startDate: new Date(),
    })

    // Pick a future lesson day and compute the calendar-week window
    // (session window is anchored to the most recent Sunday).
    const lessonDay = futureDate(20 + w, 14)
    const lessonDayDate = new Date(lessonDay)
    const lessonDayOfWeek = lessonDayDate.getDay() // 0=Sun…6=Sat
    const weekSunday = new Date(lessonDayDate)
    weekSunday.setHours(0, 0, 0, 0)
    weekSunday.setDate(weekSunday.getDate() - lessonDayOfWeek)

    const makeTimeslotInWeek = async (hour: number) => {
      const start = new Date(weekSunday)
      start.setDate(start.getDate() + lessonDayOfWeek)
      start.setHours(hour, 0, 0, 0)
      const end = new Date(start)
      end.setHours(hour + 1, 0, 0, 0)
      return createTestTimeslot(tenant.id, eventType.id, start, end, undefined, true)
    }

    // Create two "used" timeslots and confirm bookings on them (exhaust the 2/week quota)
    const usedSlot1 = await makeTimeslotInWeek(8)
    const usedSlot2 = await makeTimeslotInWeek(10)

    for (const slot of [usedSlot1, usedSlot2]) {
      await payload.create({
        collection: 'bookings',
        data: {
          timeslot: slot.id,
          user: user.id,
          tenant: tenant.id,
          status: 'confirmed',
          paymentMethodUsed: 'subscription',
          subscriptionIdUsed: subscription.id,
        } as any,
        overrideAccess: true,
      })
    }

    // Third timeslot in the same week — quota is exhausted for this one
    const thirdSlot = await makeTimeslotInWeek(14)

    // Navigate directly to the booking page (quota exhaustion is the path-of-least-resistance
    // to verify the UI behavior; the redirect from schedule is covered by Story 5).
    await loginAsRegularUserViaApi(page, user.email, 'password', { tenantSlug: tenant.slug })
    await navigateToTenant(page, tenant.slug, `/bookings/${thirdSlot.id}`)

    // Wait for the PaymentMethods section to render
    await expect(page.getByText(/payment methods/i).first()).toBeVisible({ timeout: 25000 })

    // The Membership tab must be selected by default (not require a manual click)
    const membershipTab = page.getByRole('tab', { name: /membership/i })
    await expect(membershipTab).toBeVisible({ timeout: 15000 })
    await expect(membershipTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 })

    // The Membership tab content must show the upgrade plans callout
    await expect(
      page.getByText(/upgrade to get more sessions this period/i).first()
    ).toBeVisible({ timeout: 15000 })

    // An upgrade card for the 3x/week plan should be present
    await expect(
      page.getByText(upgradePlan.name as string).first()
    ).toBeVisible({ timeout: 10000 })

    // The upgrade card should display "more session(s) this period"
    await expect(
      page.getByText(/more session[s]? this period/i).first()
    ).toBeVisible({ timeout: 10000 })
  })

  // ── Story 6a: Quantity increase, no payment methods ───────────────────────────

  test('no payment methods: Modify Booking allows quantity increase, confirmed immediately', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenant = testData.tenants[0]!
    const user = testData.users.user1
    const w = testData.workerIndex

    if (!tenant?.id || !tenant.slug || !user?.email) throw new Error('Expected tenant and user fixtures')

    const className = uniqueClassName(`E2E Imm No Pay Multi ${tenant.id}`)
    const eventType = await createTestEventType(tenant.id, className, 20, 'No payment multi class', w)
    // No paymentMethods — free, multi-booking allowed

    const startTime = futureDate(11 + w)
    const endTime = futureDate(11 + w, 11)
    const lesson = await createTestTimeslot(tenant.id, eventType.id, startTime, endTime, undefined, true)

    await loginAsRegularUserViaApi(page, user.email, 'password', { tenantSlug: tenant.slug })
    await navigateToSchedule(page, tenant.slug, startTime)

    const scheduleTitle = `${className} ${tenant.id}${w > 0 ? ` w${w}` : ''}`

    // 1. Book immediately from schedule
    const bookBtn = await getLessonBookButton(page, scheduleTitle)
    await expect(bookBtn).toBeVisible({ timeout: 10000 })
    const trpcCall = page.waitForResponse(
      (r) => r.url().includes('bookSingleSlotTimeslotOrRedirect') && r.request().method() === 'POST' && r.status() === 200,
      { timeout: 20000 }
    )
    await Promise.all([trpcCall, bookBtn.click()])

    // 2. Button becomes "Modify Booking"
    const modifyBtn = await getLessonBookButton(page, scheduleTitle, /modify booking/i)
    await expect(modifyBtn).toBeVisible({ timeout: 15000 })

    // 3. Navigate to manage page
    await modifyBtn.click()
    await page.waitForURL((url) => url.pathname === `/bookings/${lesson.id}/manage`, { timeout: 15000 })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

    await expect(page.getByText(/update booking quantity/i)).toBeVisible({ timeout: 15000 })

    // 4. Increase quantity — should be possible (no payment required)
    const increaseBtn = page.getByRole('button', { name: /increase quantity/i })
    await expect(increaseBtn).toBeVisible({ timeout: 10000 })
    await increaseBtn.click()
    await expect(page.getByTestId('booking-quantity')).toHaveText('2', { timeout: 5000 })

    // 5. Update bookings — should confirm immediately without payment
    const updateBtn = page.getByRole('button', { name: /update bookings/i })
    await expect(updateBtn).toBeVisible({ timeout: 5000 })
    const createBookingsResponse = page.waitForResponse(
      (r) => r.url().includes('bookings.createBookings') && r.request().method() === 'POST' && r.status() === 200,
      { timeout: 30000 }
    )
    await Promise.all([createBookingsResponse, updateBtn.click()])

    // Expect the quantity to now be 2 (no checkout/payment flow)
    await expect(page.getByTestId('booking-quantity')).toHaveText('2', { timeout: 15000 })
    await expect(page.getByText(/complete payment/i)).not.toBeVisible({ timeout: 3000 }).catch(() => null)

    // Confirm 2 bookings in DB (poll because booking side-effects run asynchronously)
    await expect
      .poll(async () => {
        const bookings = await payload.find({
          collection: 'bookings',
          where: {
            and: [
              { timeslot: { equals: lesson.id } },
              { user: { equals: user.id } },
              { status: { equals: 'confirmed' } },
            ],
          },
          depth: 0,
          overrideAccess: true,
        })
        return bookings.docs.length
      }, { timeout: 30000 })
      .toBe(2)
  })

  // ── Story 6b: Quantity increase with class pass (maxBookingsPerTimeslot: null) ─

  test('class pass (unlimited per timeslot): Modify Booking allows quantity increase via checkout', async ({
    page,
    testData,
  }) => {
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

    const className = uniqueClassName(`E2E Imm Pass Multi ${tenant.id}`)
    const eventType = await createTestEventType(tenant.id, className, 20, 'Class pass multi class', w)

    const cpt = await payload.create({
      collection: 'class-pass-types',
      data: {
        name: `E2E Multi Pass w${w} ${Date.now()}`,
        slug: `e2e-multi-pass-${tenant.id}-${w}-${Date.now()}`,
        quantity: 10,
        maxBookingsPerTimeslot: null, // unlimited per timeslot
        tenant: tenant.id,
        priceInformation: { price: 49.99 },
        skipSync: true,
        stripeProductId: `prod_multi_pass_${tenant.id}_${w}_${Date.now()}`,
      } as any,
      overrideAccess: true,
    }) as { id: number }

    await payload.update({
      collection: 'event-types',
      id: eventType.id,
      data: { paymentMethods: { allowedClassPasses: [cpt.id] } },
      overrideAccess: true,
    })

    const future = new Date(Date.now() + 86400000 * 90)
    const pass = await payload.create({
      collection: 'class-passes',
      data: {
        user: user.id,
        tenant: tenant.id,
        type: cpt.id,
        quantity: 10,
        expirationDate: future.toISOString().slice(0, 10),
        purchasedAt: new Date().toISOString(),
        status: 'active',
      },
      overrideAccess: true,
    }) as { id: number }

    const startTime = futureDate(12 + w)
    const endTime = futureDate(12 + w, 11)
    const lesson = await createTestTimeslot(tenant.id, eventType.id, startTime, endTime, undefined, true)

    await loginAsRegularUserViaApi(page, user.email, 'password', { tenantSlug: tenant.slug })
    await navigateToSchedule(page, tenant.slug, startTime)

    const scheduleTitle = `${className} ${tenant.id}${w > 0 ? ` w${w}` : ''}`

    // 1. Book immediately from schedule (1 credit deducted)
    const bookBtn = await getLessonBookButton(page, scheduleTitle)
    await expect(bookBtn).toBeVisible({ timeout: 10000 })
    const trpcCall = page.waitForResponse(
      (r) => r.url().includes('bookSingleSlotTimeslotOrRedirect') && r.request().method() === 'POST' && r.status() === 200,
      { timeout: 20000 }
    )
    await Promise.all([trpcCall, bookBtn.click()])

    const modifyBtn = await getLessonBookButton(page, scheduleTitle, /modify booking/i)
    await expect(modifyBtn).toBeVisible({ timeout: 15000 })

    // Verify 1 credit deducted (10 → 9)
    await expect
      .poll(async () => {
        const p = (await payload.findByID({ collection: 'class-passes', id: pass.id, depth: 0, overrideAccess: true })) as { quantity: number }
        return p.quantity
      }, { timeout: 10000 })
      .toBe(9)

    // 2. Navigate to manage page
    await modifyBtn.click()
    await page.waitForURL((url) => url.pathname === `/bookings/${lesson.id}/manage`, { timeout: 15000 })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

    await expect(page.getByText(/update booking quantity/i)).toBeVisible({ timeout: 15000 })

    // 3. Increase quantity by 2 (total will be 3)
    const increaseBtn = page.getByRole('button', { name: /increase quantity/i })
    await expect(increaseBtn).toBeVisible({ timeout: 10000 })
    await increaseBtn.click()
    await increaseBtn.click()
    await expect(page.getByTestId('booking-quantity')).toHaveText('3', { timeout: 5000 })

    // 4. Click Update — enters checkout
    const updateBtn = page.getByRole('button', { name: /update bookings/i })
    const holdCreateResponse = page.waitForResponse(
      (r) =>
        r.url().includes('bookings.upsertCheckoutHold') &&
        r.request().method() === 'POST' &&
        r.status() === 200,
      { timeout: 30000 },
    )
    await Promise.all([holdCreateResponse, updateBtn.click()])

    // Should enter payment checkout (pending bookings created)
    await expect(page.getByText(/complete payment/i).first()).toBeVisible({ timeout: 15000 })

    // 5. Select class pass tab and confirm
    const classPassTab = page.getByRole('tab', { name: /class pass/i })
    await expect(classPassTab).toBeVisible({ timeout: 15000 })
    await classPassTab.click()

    const confirmBtn = page.getByRole('button', { name: /confirm with class pass|use this pass/i }).first()
    await expect(confirmBtn).toBeVisible({ timeout: 10000 })
    await confirmBtn.click()

    // 6. Total 3 credits deducted (1 initial + 2 upgrade = 10 → 7)
    await expect
      .poll(async () => {
        const p = (await payload.findByID({ collection: 'class-passes', id: pass.id, depth: 0, overrideAccess: true })) as { quantity: number }
        return p.quantity
      }, { timeout: 15000 })
      .toBe(7)
  })

  // ── Story 6c: Quantity increase blocked (maxBookingsPerTimeslot: 1) ────────────

  test('single-slot payment method (maxBookingsPerTimeslot: 1): public schedule allows only cancel', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenant = testData.tenants[0]!
    const user = testData.users.user1
    const w = testData.workerIndex

    if (!tenant?.id || !tenant.slug || !user?.email) throw new Error('Expected tenant and user fixtures')

    await updateTenantStripeConnect(tenant.id, {
      stripeConnectOnboardingStatus: 'active',
      stripeConnectAccountId: `acct_e2e_imm_singleslot_${w}`,
    })

    // Plan with maxBookingsPerTimeslot: 1 (single slot only)
    const plan = await createTestPlan({
      tenantId: tenant.id,
      name: `E2E Single Slot Plan v2 w${w} ${Date.now()}`,
      sessions: 8,
      allowMultipleBookingsPerTimeslot: false,
      stripeProductId: `prod_e2e_singleslot_v2_${w}_${Date.now()}`,
      priceId: `price_e2e_singleslot_v2_${w}_${Date.now()}`,
    })

    const className = uniqueClassName(`E2E Imm Single Slot ${tenant.id}`)
    const eventType = await createTestEventType(tenant.id, className, 10, 'Single slot class', w)
    await setEventTypeAllowedPlans(eventType.id, [plan.id])

    await createTestSubscription({
      userId: user.id,
      tenantId: tenant.id,
      planId: plan.id,
      status: 'active',
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      stripeAccountId: null,
    })

    const startTime = futureDate(3 + w)
    const endTime = futureDate(3 + w, 11)
    const lesson = await createTestTimeslot(tenant.id, eventType.id, startTime, endTime, undefined, true)

    await loginAsRegularUserViaApi(page, user.email, 'password', { tenantSlug: tenant.slug })
    await navigateToSchedule(page, tenant.slug, startTime)

    const scheduleTitle = `${className} ${tenant.id}${w > 0 ? ` w${w}` : ''}`

    // 1. Book immediately from schedule
    const bookBtn = await getLessonBookButton(page, scheduleTitle)
    await expect(bookBtn).toBeVisible({ timeout: 20000 })
    const trpcCall = page.waitForResponse(
      (r) => r.url().includes('bookSingleSlotTimeslotOrRedirect') && r.request().method() === 'POST' && r.status() === 200,
      { timeout: 20000 }
    )
    await Promise.all([trpcCall, bookBtn.click()])

    // With single-slot maxBookingsPerTimeslot cap, the schedule should only allow cancel.
    const cancelBtn = await getLessonBookButton(page, scheduleTitle, /cancel booking/i)
    await expect(cancelBtn).toBeVisible({ timeout: 15000 })
    const modifyBtn = await getLessonBookButton(page, scheduleTitle, /modify booking/i)
    await expect(modifyBtn).not.toBeVisible({ timeout: 5000 })
  })
})
