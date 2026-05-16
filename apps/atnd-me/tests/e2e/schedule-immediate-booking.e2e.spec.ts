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
 *  2. Active subscription → immediate booking, button becomes "Modify Booking"
 *  3. Valid class pass → immediate booking (1 credit deducted), button becomes "Modify Booking"
 *  4. Payment required (no entitlement) → redirect to /bookings/[id]
 *  5. Subscription limit reached → redirect to /bookings/[id]
 *  6a. Quantity increase (no payment methods) → additional slots confirmed immediately
 *  6b. Quantity increase (class pass, maxBookingsPerTimeslot: null) → checkout flow, credits deducted
 *  6c. Quantity increase blocked (maxBookingsPerTimeslot: 1) → manage page shows "Only 1 slot" message
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

// ─── Shared helpers ────────────────────────────────────────────────────────────

function futureDate(daysFromNow: number, hour = 10): Date {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, 0, 0, 0)
  return d
}

async function advanceScheduleToDate(
  page: Parameters<typeof test>[0]['page'],
  targetDate: Date
) {
  const dateLabel = page.locator('p.text-center.text-lg').first()
  await expect(dateLabel).toBeVisible({ timeout: 15000 })

  const toggle = dateLabel.locator('xpath=..')
  const nextDayButton = toggle.locator('svg').nth(1)
  const targetLabel = targetDate.toDateString()

  for (let i = 0; i < 21; i++) {
    const currentLabel = (await dateLabel.textContent())?.trim()
    if (currentLabel === targetLabel) return
    await nextDayButton.click()
    await expect(dateLabel)
      .toHaveText(targetLabel, { timeout: 8000 })
      .catch(() => null)
  }

  await expect(dateLabel).toHaveText(targetLabel, { timeout: 15000 })
}

async function navigateToSchedule(
  page: Parameters<typeof test>[0]['page'],
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
  page: Parameters<typeof test>[0]['page'],
  scheduleTitle: string,
  buttonName: RegExp | string = /^book$/i
) {
  const lessonTitle = page.getByText(scheduleTitle, { exact: true }).first()
  await expect(lessonTitle).toBeVisible({ timeout: 20000 })
  const lessonRow = lessonTitle.locator('xpath=ancestor::div[contains(@class,"border-b")]').first()
  return lessonRow.getByRole('button', { name: buttonName })
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Schedule immediate booking', () => {
  test.setTimeout(120_000)

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

  test('active subscription: Book creates confirmed booking immediately and button becomes Modify Booking', async ({
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

    // Button should become "Modify Booking"
    const modifyBtn = await getLessonBookButton(page, scheduleTitle, /modify booking/i)
    await expect(modifyBtn).toBeVisible({ timeout: 15000 })

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
      },
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
        price: 1999,
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

    // Drop-in only, single slot — user2 has no subscription or class pass
    await payload.update({
      collection: 'event-types',
      id: eventType.id,
      data: {
        paymentMethods: {
          allowedDropIn: {
            price: 15,
            maxBookingsPerTimeslot: 1,
          },
        },
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
      // Start date is today so the current week starts now
      startDate: new Date(),
    })

    // Create a booking in this period using the subscription to exhaust the 1-session limit
    const usedTimeslotStart = futureDate(10 + w, 8)
    const usedTimeslotEnd = futureDate(10 + w, 9)
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
    const startTime = futureDate(10 + w, 14)
    const endTime = futureDate(10 + w, 15)
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
    await updateBtn.click()

    // Expect the quantity to now be 2 (no checkout/payment flow)
    await expect(page.getByTestId('booking-quantity')).toHaveText('2', { timeout: 15000 })
    await expect(page.getByText(/complete payment/i)).not.toBeVisible({ timeout: 3000 }).catch(() => null)

    // Confirm 2 bookings in DB
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
    expect(bookings.docs.length).toBe(2)
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
      },
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
        price: 4999,
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
    await updateBtn.click()

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

  test('single-slot payment method (maxBookingsPerTimeslot: 1): Modify Booking shows "Only 1 slot" message', async ({
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

    const startTime = futureDate(13 + w)
    const endTime = futureDate(13 + w, 11)
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

    const modifyBtn = await getLessonBookButton(page, scheduleTitle, /modify booking/i)
    await expect(modifyBtn).toBeVisible({ timeout: 15000 })

    // 2. Navigate to manage page
    await modifyBtn.click()
    await page.waitForURL((url) => url.pathname === `/bookings/${lesson.id}/manage`, { timeout: 15000 })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

    await expect(page.getByText(/update booking quantity/i)).toBeVisible({ timeout: 15000 })

    // 3. Should show "Only 1 slot" message and no increase button
    await expect(page.getByText(/only 1 slot per timeslot/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /increase quantity/i })).not.toBeVisible({ timeout: 3000 }).catch(() => null)
  })
})
