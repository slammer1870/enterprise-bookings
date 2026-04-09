/**
 * Step 2.7.2 – E2E: Checkout UI shows when payment methods are attached (Payment Methods / Drop-in tab).
 * Verifies total displayed includes booking fee (class price + fee), not class price only.
 */
import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestClassOption,
  createTestLesson,
  getPayloadInstance,
} from './helpers/data-helpers'

test.describe('Booking fee disclosure (step 2.7.2)', () => {
  test.describe.configure({ timeout: 90_000 })
  test('checkout UI shows when payment methods are attached (Drop-in tab)', async ({
    page,
    testData,
    request,
  }) => {
    const payload = await getPayloadInstance()

    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const w = testData.workerIndex

    if (!tenantId || !tenantSlug) {
      throw new Error('Tenant ID or slug is missing from test data')
    }

    // Set platform fee to 10% for this tenant so total = €10 + €1 = €11.00
    const platformFees = (await payload.findGlobal({
      slug: 'platform-fees',
      depth: 0,
      overrideAccess: true,
    })) as { defaults?: object; overrides?: Array<{ tenant: number; dropInPercent?: number }> } | null
    const overrides = platformFees?.overrides ?? []
    const existingIdx = overrides.findIndex((o: { tenant: number }) => o.tenant === tenantId)
    const newOverrides =
      existingIdx >= 0
        ? overrides.map((o, i) => (i === existingIdx ? { ...o, dropInPercent: 10 } : o))
        : [...overrides, { tenant: tenantId, dropInPercent: 10 }]
    await payload.updateGlobal({
      slug: 'platform-fees',
      data: {
        defaults: platformFees?.defaults ?? { dropInPercent: 2, classPassPercent: 3, subscriptionPercent: 4 },
        overrides: newOverrides,
      },
      depth: 0,
      overrideAccess: true,
    } as Parameters<typeof payload.updateGlobal>[0])

    // Update tenant with Stripe Connect setup
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: `acct_fee_disclosure_${tenantId}`,
      },
      overrideAccess: true,
    })

    // Create drop-in: price 10 = €10.00 (currency units)
    const dropIn = await payload.create({
      collection: 'drop-ins',
      data: {
        name: `Fee Disclosure Drop-in ${tenantId}-w${w}-${Date.now()}`,
        isActive: true,
        price: 10,
        adjustable: true,
        paymentMethods: ['card'],
        tenant: tenantId,
      },
      overrideAccess: true,
    }) as { id: number }

    // Create class option with tenant relationship
    const classOption = await createTestClassOption(tenantId, 'Fee Disclosure Class', 5, undefined, w)

    // Update class option with drop-in payment method
    await payload.update({
      collection: 'event-types',
      id: classOption.id,
      data: {
        paymentMethods: { allowedDropIn: dropIn.id },
        tenant: tenantId, // Ensure tenant relationship is set
      },
      overrideAccess: true,
    })

    // Create lesson with proper time window (tomorrow to ensure it's in the future)
    const startTime = new Date()
    startTime.setDate(startTime.getDate() + 1) // Set to tomorrow
    startTime.setHours(12, 0, 0, 0)
    const endTime = new Date(startTime)
    endTime.setHours(13, 0, 0, 0)
    const lesson = await createTestLesson(tenantId, classOption.id, startTime, endTime, undefined, true)

    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password', {
      request,
      tenantSlug,
    })

    // Warm-up tenant routing/session before hitting the booking page directly.
    await navigateToTenant(page, tenantSlug, '/')
    await page.waitForLoadState('domcontentloaded').catch(() => null)
    if (await page.getByText(/tenant not found/i).isVisible().catch(() => false)) {
      throw new Error(
        `Tenant "${tenantSlug}" not found when loading tenant root. App and test must use the same DB (DATABASE_URI). Lesson ${lesson.id}.`
      )
    }
    await page.waitForURL((u) => u.pathname === '/home', { timeout: 10000 }).catch(() => null)

    const bookingPath = `/bookings/${lesson.id}`
    const goToBooking = async () => {
      await navigateToTenant(page, tenantSlug, bookingPath)
      await page.waitForLoadState('domcontentloaded').catch(() => null)
      return new URL(page.url()).pathname
    }
    let currentPath = await goToBooking()
    for (const delayMs of [1500, 2500]) {
      if (currentPath !== '/home' && currentPath.startsWith('/bookings/')) break
      await new Promise((r) => setTimeout(r, delayMs))
      currentPath = await goToBooking()
    }
    if (currentPath === '/home' || !currentPath.startsWith('/bookings/')) {
      throw new Error(
        `Booking page redirected away. Lesson ${lesson.id}, tenant ${tenantSlug}. Expected ${bookingPath}, got ${currentPath}. Check server logs for createBookingPage or getByIdForBooking.`
      )
    }
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

    // Wait for booking page: either Payment Methods (success) or error (fail fast with clear message).
    const result = await Promise.race([
      page.getByText(/payment methods/i).first().waitFor({ state: 'visible', timeout: 15000 }).then(() => 'success'),
      page.getByText(/something went wrong/i).waitFor({ state: 'visible', timeout: 15000 }).then(() => 'error'),
    ]).catch(() => 'timeout')

    if (result === 'error') {
      const url = page.url()
      const isRouteBoundary = await page.getByRole('heading', { name: /booking page error/i }).isVisible().catch(() => false)
      const boundaryHint = isRouteBoundary
        ? 'Route error boundary (client error in booking/payment components). Check browser console.'
        : 'Global error boundary. Check server logs for [createBookingPage] or [postValidation].'
      throw new Error(
        `Booking page hit error boundary. Lesson ${lesson.id}, tenant ${tenantSlug}. URL: ${url}. ${boundaryHint}`
      )
    }
    if (result === 'timeout') {
      const url = page.url()
      const pathname = new URL(url).pathname
      if (!pathname.startsWith('/bookings/')) {
        throw new Error(
          `Booking page redirected away (likely server error). Lesson ${lesson.id}, tenant ${tenantSlug}. Final URL: ${url}. Check server logs for [createBookingPage].`
        )
      }
      const body = await page.textContent('body').catch(() => '')
      throw new Error(`Timeout waiting for booking page. Lesson ${lesson.id}. URL: ${url}. Body: ${body?.slice(0, 300) ?? 'none'}`)
    }

    expect(new URL(page.url()).hostname).toBe(`${tenantSlug}.localhost`)
    await expect(page).toHaveURL(new RegExp(`/bookings/${lesson.id}$`), { timeout: 5000 })
    const paymentMethodsEl = page.getByText(/payment methods/i).first()
    await paymentMethodsEl.scrollIntoViewIfNeeded().catch(() => null)
    await expect(paymentMethodsEl).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('tab', { name: /drop-?in/i })).toBeVisible()
    // Click Drop-in tab and verify fee breakdown is visible
    await page.getByRole('tab', { name: /drop-?in/i }).click()
    await expect(page.getByTestId('booking-fee-breakdown')).toBeVisible({ timeout: 10000 })

    // Verify breakdown: class €10.00, fee €1.00 (10%), total €11.00
    await expect(page.getByTestId('class-price')).toHaveText('€10.00')
    await expect(page.getByTestId('booking-fee')).toHaveText('€1.00')
    await expect(page.getByTestId('total')).toHaveText('€11.00')

    // Verify total next to Pay button includes booking fee (not class price only)
    // `payment-total` is rendered only after the fee breakdown query returns in the payment UI.
    // Wait for that request in CI to avoid flakiness.
    await page
      .waitForResponse(
        (resp) =>
          resp.url().includes('/api/trpc/payments.getDropInFeeBreakdown') && resp.status() === 200,
        { timeout: 15000 },
      )
      .catch(() => null)
    await expect(page.getByTestId('payment-total')).toHaveText('€11.00', { timeout: 15000 })
  })
})
