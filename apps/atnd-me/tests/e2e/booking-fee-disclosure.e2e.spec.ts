/**
 * Step 2.7.2 – E2E: Checkout UI shows when payment methods are attached (Payment Methods / Drop-in tab).
 */
import { test, expect } from './helpers/fixtures'
import { loginAsRegularUser } from './helpers/auth-helpers'
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
  }) => {
    const payload = await getPayloadInstance()
    
    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug

    if (!tenantId || !tenantSlug) {
      throw new Error('Tenant ID or slug is missing from test data')
    }

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

    // Create drop-in payment method
    const dropIn = await payload.create({
      collection: 'drop-ins',
      data: {
        name: `Fee Disclosure Drop-in ${tenantId}-${Date.now()}`,
        isActive: true,
        price: 1000,
        adjustable: true,
        paymentMethods: ['card'],
        tenant: tenantId,
      },
      overrideAccess: true,
    }) as { id: number }
    
    // Create class option with tenant relationship
    const classOption = await createTestClassOption(tenantId, 'Fee Disclosure Class', 5)
    
    // Update class option with drop-in payment method
    await payload.update({
      collection: 'class-options',
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

    await loginAsRegularUser(page, 1, testData.users.user1.email, 'password', { tenantSlug })
    await navigateToTenant(page, tenantSlug, `/bookings/${lesson.id}`)
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
  })
})
