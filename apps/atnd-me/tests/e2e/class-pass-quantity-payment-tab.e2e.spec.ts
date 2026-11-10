/**
 * Booking page: increasing quantity while the Class pass tab is selected.
 *
 * Setup
 * ─────
 *   • Frontend tenant booking page (`/bookings/[id]`)
 *   • Drop-in allows multiple spots per timeslot (adjustable)
 *   • Class pass type allows multiple spots, and the user already holds a pass
 *   • Timeslot capacity is high enough that quantity can move from 1 to 2
 *
 * Expected behaviour
 * ──────────────────
 *   With the Class pass tab open, increasing quantity must keep that tab
 *   selected and keep the pass checkout visible. The page must not flash
 *   "No payment methods are available", and the quantity change must not
 *   make POST /api/stripe/connect/create-payment-intent reject the body.
 */
import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  getPayloadInstance,
} from './helpers/data-helpers'

const CREATE_PAYMENT_INTENT_PATH = '/api/stripe/connect/create-payment-intent'

test.describe('Booking page: class pass tab survives a quantity increase', () => {
  test.describe.configure({ timeout: 180_000 })

  test('keeps class pass selected and does not send an invalid payment intent body', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenant = testData.tenants[0]
    const user = testData.users.user1
    const workerIndex = testData.workerIndex
    const ts = Date.now()

    if (!tenant?.id || !tenant.slug) throw new Error('Tenant required')

    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: null,
      },
      overrideAccess: true,
    })

    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `Class Pass Qty Drop-in ${tenant.id}-w${workerIndex}-${ts}`,
        isActive: true,
        price: 15,
        adjustable: true,
        tenant: tenant.id,
      },
      overrideAccess: true,
    })) as { id: number }

    const classPassType = (await payload.create({
      collection: 'class-pass-types',
      data: {
        name: `Class Pass Qty Pack ${tenant.id}-w${workerIndex}-${ts}`,
        slug: `class-pass-qty-${tenant.id}-${workerIndex}-${ts}`,
        quantity: 10,
        tenant: tenant.id,
        maxBookingsPerTimeslot: 4,
        priceInformation: { price: 40 },
        skipSync: true,
        stripeProductId: `prod_cp_qty_${tenant.id}_${workerIndex}_${ts}`,
      },
      overrideAccess: true,
    })) as { id: number }

    const eventType = await createTestEventType(
      tenant.id,
      `Class Pass Qty ${ts}`,
      5,
      undefined,
      workerIndex,
    )

    await payload.update({
      collection: 'event-types',
      id: eventType.id,
      data: {
        paymentMethods: {
          allowedDropIn: dropIn.id,
        },
      },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'class-pass-types',
      id: classPassType.id,
      data: { allowedEventTypes: [eventType.id] },
      overrideAccess: true,
    })

    const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await payload.create({
      collection: 'class-passes',
      data: {
        user: user.id,
        tenant: tenant.id,
        type: classPassType.id,
        quantity: 4,
        expirationDate: expiry.toISOString().slice(0, 10),
        purchasedAt: new Date().toISOString(),
        status: 'active',
      },
      overrideAccess: true,
    })

    const startTime = new Date()
    startTime.setHours(14, 0, 0, 0)
    startTime.setDate(startTime.getDate() + 5 + workerIndex)
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

    type PaymentIntentResult = { status: number; body: string }
    const paymentIntentResults: PaymentIntentResult[] = []
    let paymentIntentsInFlight = 0
    let pendingPaymentIntentBodies = 0
    let watchPaymentIntents = false

    const isPaymentIntent = (url: string) => url.includes(CREATE_PAYMENT_INTENT_PATH)

    page.on('request', (request) => {
      if (!isPaymentIntent(request.url())) return
      paymentIntentsInFlight += 1
    })
    page.on('requestfinished', (request) => {
      if (!isPaymentIntent(request.url())) return
      paymentIntentsInFlight = Math.max(0, paymentIntentsInFlight - 1)
    })
    page.on('requestfailed', (request) => {
      if (!isPaymentIntent(request.url())) return
      paymentIntentsInFlight = Math.max(0, paymentIntentsInFlight - 1)
      if (!watchPaymentIntents) return
      paymentIntentResults.push({
        status: 0,
        body: request.failure()?.errorText ?? 'request failed',
      })
    })
    page.on('response', (response) => {
      if (!watchPaymentIntents) return
      if (!isPaymentIntent(response.url())) return
      pendingPaymentIntentBodies += 1
      void response
        .text()
        .catch(() => '')
        .then((body) => {
          paymentIntentResults.push({ status: response.status(), body: body.slice(0, 500) })
        })
        .finally(() => {
          pendingPaymentIntentBodies = Math.max(0, pendingPaymentIntentBodies - 1)
        })
    })

    await loginAsRegularUserViaApi(page, user.email, 'password', { tenantSlug: tenant.slug })
    await navigateToTenant(page, tenant.slug, '/')
    await page.waitForLoadState('domcontentloaded').catch(() => null)
    await navigateToTenant(page, tenant.slug, `/bookings/${timeslot.id}`)

    const dropInTab = page.getByRole('tab', { name: /drop-?in/i })
    const classPassTab = page.getByRole('tab', { name: /class pass/i })
    const increaseBtn = page.getByRole('button', { name: 'Increase quantity' })
    const quantityReadout = page
      .getByRole('button', { name: 'Decrease quantity' })
      .locator('xpath=following-sibling::span[1]')

    await expect(page.getByText(/select quantity/i).first()).toBeVisible({ timeout: 20_000 })
    await expect(dropInTab).toBeVisible({ timeout: 20_000 })
    await expect(classPassTab).toBeVisible({ timeout: 20_000 })
    await expect(increaseBtn).toBeEnabled()

    // Open Class pass as soon as the tab exists. A drop-in payment intent may
    // still be in flight; leaving that tab aborts it.
    watchPaymentIntents = true
    await classPassTab.click()
    await expect(classPassTab).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('button', { name: /confirm with class pass/i })).toBeVisible()
    await expect(page.getByText(/this will use 1 credit from your pass/i)).toBeVisible()

    await page.evaluate(() => {
      const target = window as Window & { __noPaymentMethodsText?: string }
      target.__noPaymentMethodsText = ''
      const record = () => {
        const match = document.body?.innerText?.match(/no payment methods are available[^\n]*/i)
        if (match?.[0] && !target.__noPaymentMethodsText) {
          target.__noPaymentMethodsText = match[0]
        }
      }
      const observer = new MutationObserver(record)
      observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    })

    const classPassRefresh = page.waitForResponse(
      (response) =>
        response.url().includes('getValidClassPassesForTimeslot') && response.ok(),
      { timeout: 20_000 },
    )

    await increaseBtn.click()
    await expect(quantityReadout).toHaveText('2')
    await classPassRefresh
    await expect
      .poll(() => paymentIntentsInFlight === 0 && pendingPaymentIntentBodies === 0, {
        timeout: 20_000,
      })
      .toBe(true)

    const emptyPaymentMethods = await page.evaluate(
      () =>
        (window as Window & { __noPaymentMethodsText?: string }).__noPaymentMethodsText ?? '',
    )
    const invalidJson = paymentIntentResults.filter(
      (result) =>
        result.body.includes('Invalid JSON body') ||
        /unexpected end of json|invalid json/i.test(result.body),
    )

    expect
      .soft(
        emptyPaymentMethods,
        'quantity increase flashed an empty payment-methods state before the tabs reloaded',
      )
      .toBe('')
    expect
      .soft(
        invalidJson,
        `create-payment-intent rejected the body. Responses: ${JSON.stringify(paymentIntentResults)}`,
      )
      .toEqual([])
    await expect
      .soft(page.getByRole('tab', { selected: true }), 'payment methods reloaded onto Drop-in')
      .toHaveText(/class pass/i)
    await expect
      .soft(page.getByText(/this will use 2 credits from your pass/i))
      .toBeVisible()
    await expect.soft(dropInTab).toBeVisible()
    await expect.soft(classPassTab).toBeVisible()
  })
})
