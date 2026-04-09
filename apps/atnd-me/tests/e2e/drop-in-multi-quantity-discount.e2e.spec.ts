/**
 * E2E: Drop-in multi-quantity pricing applies discount tiers.
 * Verifies:
 * - User can increase quantity to 2
 * - Discount tier applies and UI shows discounted total
 * - The discounted price is what gets posted to the payment-intent endpoint
 */
import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { createTestClassOption, createTestLesson, getPayloadInstance } from './helpers/data-helpers'

test.describe('Drop-in multi-quantity discount', () => {
  test.describe.configure({ timeout: 90_000 })

  test('quantity-based discount applies and is sent to payment intent', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()

    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    if (!tenantId || !tenantSlug) {
      throw new Error('Tenant ID or slug is missing from test data')
    }

    // Ensure tenant is connected (some flows gate payments UI behind connect status).
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: `acct_dropin_discount_${tenantId}`,
      },
      overrideAccess: true,
    })

    // Create drop-in with a simple discount tier: 10% off when quantity >= 2
    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `E2E Drop-in Discount ${tenantId}-${Date.now()}`,
        isActive: true,
        price: 10, // currency units (e.g. €10.00) – converted to cents server-side
        adjustable: true,
        paymentMethods: ['card'],
        discountTiers: [{ minQuantity: 2, discountPercent: 10, type: 'normal' }],
        tenant: tenantId,
      },
      overrideAccess: true,
    })) as { id: number }

    const classOption = await createTestClassOption(tenantId, 'Drop-in Discount Class', 5)
    await payload.update({
      collection: 'event-types',
      id: classOption.id,
      data: {
        paymentMethods: { allowedDropIn: dropIn.id },
        tenant: tenantId,
      },
      overrideAccess: true,
    })

    // Create a future lesson.
    const startTime = new Date()
    startTime.setDate(startTime.getDate() + 1)
    startTime.setHours(12, 0, 0, 0)
    const endTime = new Date(startTime)
    endTime.setHours(13, 0, 0, 0)
    const lesson = await createTestLesson(tenantId, classOption.id, startTime, endTime, undefined, true)

    // API login + tenant-scoped cookies so session is sent on tenant subdomain (same as app-smoke).
    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password', { tenantSlug })

    // Warm-up: ensure app can resolve tenant (same DB). Fail fast if tenant not found.
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

    // Wait for booking page: success, error, or tenant 404 (fail fast).
    const result = await Promise.race([
      page.getByText(/payment methods/i).first().waitFor({ state: 'visible', timeout: 15000 }).then(() => 'success'),
      page.getByText(/something went wrong/i).waitFor({ state: 'visible', timeout: 15000 }).then(() => 'error'),
      page.getByText(/tenant not found/i).waitFor({ state: 'visible', timeout: 15000 }).then(() => 'tenant_not_found'),
    ]).catch(() => 'timeout')

    if (result === 'error') {
      const body = await page.textContent('body').catch(() => '')
      throw new Error(`Server error on booking page. Lesson ${lesson.id}, tenant ${tenantSlug}.\n${body?.slice(0, 500)}`)
    }
    if (result === 'tenant_not_found') {
      throw new Error(
        `Tenant "${tenantSlug}" not found on subdomain. Lesson ${lesson.id}. Ensure app and test use the same DB (DATABASE_URI).`
      )
    }
    if (result === 'timeout') {
      const url = page.url()
      const hasHome = /\/home$/.test(new URL(url).pathname)
      const body = await page.textContent('body').catch(() => '')
      const hint = hasHome
        ? ' Redirected to /home — booking page likely failed (lesson not found or tenant mismatch).'
        : ''
      throw new Error(
        `Timeout waiting for booking page. Lesson ${lesson.id}, tenant ${tenantSlug}. URL: ${url}.${hint} Body: ${body?.slice(0, 300) ?? 'none'}`
      )
    }

    expect(new URL(page.url()).hostname).toBe(`${tenantSlug}.localhost`)
    await expect(page).toHaveURL(new RegExp(`/bookings/${lesson.id}$`), { timeout: 5000 })
    const paymentMethodsEl = page.getByText(/payment methods/i).first()
    await paymentMethodsEl.scrollIntoViewIfNeeded().catch(() => null)
    await expect(paymentMethodsEl).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('tab', { name: /drop-?in/i })).toBeVisible()

    await page.getByRole('tab', { name: /drop-?in/i }).click()

    // Baseline: quantity 1 shows class price €10.00 and total €11.00 in the price breakdown.
    await expect(page.getByText(/^Total$/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('€10.00').first()).toBeVisible({ timeout: 15_000 })

    // Wait for the *discounted* payment intent request when quantity becomes 2 (price should be 18.00).
    const discountedRequestPromise = page.waitForRequest(
      (req) => {
        if (!req.url().includes('create-payment-intent')) return false
        if (req.method() !== 'POST') return false
        try {
          const body = req.postDataJSON() as { price?: unknown }
          return Number(body?.price) === 18
        } catch {
          return false
        }
      },
      { timeout: 30_000 }
    )

    // Increase quantity to 2 (should trigger discount tier and a new payment intent creation)
    const inc = page.getByRole('button', { name: 'Increase quantity' })
    await inc.scrollIntoViewIfNeeded()
    await expect(inc).toBeVisible({ timeout: 10_000 })
    await expect(inc).toBeEnabled({ timeout: 10_000 })
    await Promise.all([discountedRequestPromise, inc.click()])

    // UI shows original total struck-through and discounted total visible (multiple nodes can show same amount)
    await expect(page.getByText('€20.00').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('€18.00').first()).toBeVisible({ timeout: 15_000 })

    // Verify the discounted amount is what is posted to the payment intent endpoint
    const req = await discountedRequestPromise
    const body = req.postDataJSON() as { price?: unknown }
    expect(body.price).toBe(18)
  })
})

