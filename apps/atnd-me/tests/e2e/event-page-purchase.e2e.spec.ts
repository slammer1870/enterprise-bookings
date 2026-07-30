/**
 * Event page ticket purchase: guest (1 + multi) and authenticated drop-in →
 * mock PaymentIntent → signed webhook fulfills checkout hold → confirmed bookings.
 */
import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import {
  createTestEventType,
  createTestPage,
  createTestTimeslot,
  getPayloadInstance,
} from './helpers/data-helpers'
import { postHoldFulfillmentWebhook } from './helpers/stripe-webhook-helpers'

async function seedEventPageWithDropIn(opts: {
  tenantId: number
  workerIndex: number
  label: string
  places?: number
  connectAccountId: string
}) {
  const payload = await getPayloadInstance()
  const { tenantId, workerIndex, label, connectAccountId } = opts
  const places = opts.places ?? 8

  await payload.update({
    collection: 'tenants',
    id: tenantId,
    data: {
      stripeConnectOnboardingStatus: 'active',
      stripeConnectAccountId: connectAccountId,
    },
    overrideAccess: true,
  })

  const dropIn = (await payload.create({
    collection: 'drop-ins',
    data: {
      name: `E2E Event Purchase ${label} ${tenantId}-w${workerIndex}-${Date.now()}`,
      isActive: true,
      price: 15,
      adjustable: true,
      tenant: tenantId,
    },
    overrideAccess: true,
  })) as { id: number }

  const eventType = await createTestEventType(
    tenantId,
    `Event Purchase ${label}`,
    places,
    undefined,
    workerIndex,
  )

  await payload.update({
    collection: 'event-types',
    id: eventType.id,
    data: {
      paymentMethods: { allowedDropIn: dropIn.id },
      tenant: tenantId,
    },
    overrideAccess: true,
  })

  const startTime = new Date()
  startTime.setHours(18, 0, 0, 0)
  startTime.setDate(startTime.getDate() + 3 + workerIndex)
  const endTime = new Date(startTime)
  endTime.setHours(19, 0, 0, 0)

  const lesson = await createTestTimeslot(
    tenantId,
    eventType.id,
    startTime,
    endTime,
    undefined,
    true,
  )

  const pageSlug = `e2e-event-purchase-${label}-w${workerIndex}-${Date.now()}`
  await createTestPage(tenantId, pageSlug, `E2E Event Purchase ${label}`, {
    layout: [
      {
        blockType: 'event',
        eventType: eventType.id,
        timeslot: lesson.id,
      },
    ],
  })

  return {
    payload,
    lessonId: lesson.id as number,
    pageSlug,
    dropInId: dropIn.id,
  }
}

async function countConfirmedBookingsForUserTimeslot(
  payload: Awaited<ReturnType<typeof getPayloadInstance>>,
  timeslotId: number,
  userId: number,
) {
  const result = await payload.find({
    collection: 'bookings',
    where: {
      and: [
        { timeslot: { equals: timeslotId } },
        { user: { equals: userId } },
        { status: { equals: 'confirmed' } },
      ],
    },
    depth: 0,
    limit: 50,
    overrideAccess: true,
  })
  return result.totalDocs ?? 0
}

async function findActiveHoldId(
  payload: Awaited<ReturnType<typeof getPayloadInstance>>,
  timeslotId: number,
  userId: number,
): Promise<number | null> {
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
    limit: 1,
    overrideAccess: true,
  })
  const id = result.docs[0]?.id
  return typeof id === 'number' ? id : null
}

test.describe('Event page: ticket purchase', () => {
  test.describe.configure({ timeout: 120_000 })

  test('guest purchases 1 ticket via Continue → mock PI → webhook → confirmed booking', async ({
    page,
    testData,
    request,
  }) => {
    const tenant = testData.tenants[0]!
    const workerIndex = testData.workerIndex
    const connectAccountId = `acct_e2e_event_buy_1_${tenant.id}_w${workerIndex}`
    const { payload, lessonId, pageSlug } = await seedEventPageWithDropIn({
      tenantId: tenant.id as number,
      workerIndex,
      label: 'guest-1',
      connectAccountId,
    })

    const guestEmail = `event-buy-1-${workerIndex}-${Date.now()}@example.com`
    const guestName = 'Event Buyer One'

    await navigateToTenant(page, tenant.slug, `/${pageSlug}`)
    await expect(page.getByTestId('event-ticket-panel')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('event-places-remaining')).toContainText(/places left|place left/i)

    await page.locator('#guest-name').fill(guestName)
    await page.locator('#guest-email').fill(guestEmail)

    const reservePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/events/guest-reserve-hold') &&
        res.request().method() === 'POST' &&
        res.status() === 200,
      { timeout: 30_000 },
    )
    const checkoutPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/events/guest-checkout') &&
        res.request().method() === 'POST' &&
        res.status() === 200,
      { timeout: 30_000 },
    )

    await page.getByTestId('guest-checkout-continue').click()
    await reservePromise
    const checkoutRes = await checkoutPromise
    const checkoutJson = (await checkoutRes.json()) as {
      clientSecret?: string
      holdId?: number
      stripeAccountId?: string
    }

    expect(checkoutJson.clientSecret).toMatch(/^pi_test_.*_secret_test$/)
    expect(checkoutJson.holdId).toEqual(expect.any(Number))
    expect(checkoutJson.stripeAccountId).toBe(connectAccountId)
    await expect(page.getByTestId('stripe-not-configured')).toBeVisible({ timeout: 15_000 })

    const guestUser = await payload.find({
      collection: 'users',
      where: { email: { equals: guestEmail } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    expect(guestUser.docs).toHaveLength(1)
    const guestUserId = guestUser.docs[0]!.id as number

    const webhook = await postHoldFulfillmentWebhook(request, {
      connectAccountId,
      userId: guestUserId,
      tenantId: tenant.id as number,
      holdId: checkoutJson.holdId!,
      timeslotId: lessonId,
      quantity: 1,
      paymentIntentId: checkoutJson.clientSecret!.replace(/_secret_test$/, ''),
    })
    expect(webhook.status).toBe(200)

    await expect
      .poll(() => countConfirmedBookingsForUserTimeslot(payload, lessonId, guestUserId), {
        timeout: 15_000,
      })
      .toBe(1)
  })

  test('guest purchases 2 tickets via quantity selector → webhook → 2 confirmed bookings', async ({
    page,
    testData,
    request,
  }) => {
    const tenant = testData.tenants[0]!
    const workerIndex = testData.workerIndex
    const connectAccountId = `acct_e2e_event_buy_2_${tenant.id}_w${workerIndex}`
    const { payload, lessonId, pageSlug } = await seedEventPageWithDropIn({
      tenantId: tenant.id as number,
      workerIndex,
      label: 'guest-2',
      places: 5,
      connectAccountId,
    })

    const guestEmail = `event-buy-2-${workerIndex}-${Date.now()}@example.com`

    await navigateToTenant(page, tenant.slug, `/${pageSlug}`)
    await expect(page.getByTestId('event-ticket-panel')).toBeVisible({ timeout: 20_000 })

    const increaseQty = page.getByRole('button', { name: /increase quantity/i }).first()
    await expect(increaseQty).toBeVisible({ timeout: 10_000 })
    await increaseQty.click()

    await page.locator('#guest-name').fill('Event Buyer Two')
    await page.locator('#guest-email').fill(guestEmail)

    const reservePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/events/guest-reserve-hold') &&
        res.request().method() === 'POST' &&
        res.status() === 200,
      { timeout: 30_000 },
    )
    const checkoutPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/events/guest-checkout') &&
        res.request().method() === 'POST' &&
        res.status() === 200,
      { timeout: 30_000 },
    )

    await page.getByTestId('guest-checkout-continue').click()
    const reserveRes = await reservePromise
    const reserveJson = (await reserveRes.json()) as { quantity?: number; holdId?: number }
    expect(reserveJson.quantity).toBe(2)

    const checkoutRes = await checkoutPromise
    const checkoutJson = (await checkoutRes.json()) as {
      clientSecret?: string
      holdId?: number
    }
    expect(checkoutJson.holdId).toEqual(expect.any(Number))
    await expect(page.getByTestId('stripe-not-configured')).toBeVisible({ timeout: 15_000 })

    const guestUser = await payload.find({
      collection: 'users',
      where: { email: { equals: guestEmail } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const guestUserId = guestUser.docs[0]!.id as number

    const webhook = await postHoldFulfillmentWebhook(request, {
      connectAccountId,
      userId: guestUserId,
      tenantId: tenant.id as number,
      holdId: checkoutJson.holdId!,
      timeslotId: lessonId,
      quantity: 2,
      paymentIntentId: checkoutJson.clientSecret!.replace(/_secret_test$/, ''),
    })
    expect(webhook.status).toBe(200)

    await expect
      .poll(() => countConfirmedBookingsForUserTimeslot(payload, lessonId, guestUserId), {
        timeout: 15_000,
      })
      .toBe(2)
  })

  test('authenticated user purchases 1 ticket via drop-in → webhook → confirmed booking', async ({
    page,
    testData,
    request,
  }) => {
    const tenant = testData.tenants[0]!
    const user = testData.users.user1
    const workerIndex = testData.workerIndex
    const connectAccountId = `acct_e2e_event_buy_auth_${tenant.id}_w${workerIndex}`
    const { payload, lessonId, pageSlug } = await seedEventPageWithDropIn({
      tenantId: tenant.id as number,
      workerIndex,
      label: 'auth-1',
      connectAccountId,
    })

    await loginAsRegularUserViaApi(page, user.email, 'password', {
      request,
      tenantSlug: tenant.slug,
    })

    const paymentIntentPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/stripe/connect/create-payment-intent') &&
        res.request().method() === 'POST' &&
        res.status() === 200,
      { timeout: 45_000 },
    )

    await navigateToTenant(page, tenant.slug, `/${pageSlug}`)
    await expect(page.getByTestId('event-ticket-panel')).toBeVisible({ timeout: 20_000 })

    const paymentIntentRes = await paymentIntentPromise
    const paymentIntentJson = (await paymentIntentRes.json()) as { clientSecret?: string }
    expect(paymentIntentJson.clientSecret).toMatch(/^pi_test_.*_secret_test$/)
    await expect(page.getByTestId('stripe-not-configured')).toBeVisible({ timeout: 15_000 })

    await expect
      .poll(() => findActiveHoldId(payload, lessonId, user.id as number), { timeout: 20_000 })
      .not.toBeNull()

    const resolvedHoldId = await findActiveHoldId(payload, lessonId, user.id as number)
    expect(resolvedHoldId).toEqual(expect.any(Number))

    const webhook = await postHoldFulfillmentWebhook(request, {
      connectAccountId,
      userId: user.id as number,
      tenantId: tenant.id as number,
      holdId: resolvedHoldId!,
      timeslotId: lessonId,
      quantity: 1,
      paymentIntentId: paymentIntentJson.clientSecret!.replace(/_secret_test$/, ''),
    })
    expect(webhook.status).toBe(200)

    await expect
      .poll(
        () => countConfirmedBookingsForUserTimeslot(payload, lessonId, user.id as number),
        { timeout: 15_000 },
      )
      .toBe(1)
  })
})
