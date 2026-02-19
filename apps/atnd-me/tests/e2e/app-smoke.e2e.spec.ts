/**
 * App smoke tests – whole-app coverage including checkout in all situations.
 * Run in local profile (test:e2e:local) and CI.
 */
import { test, expect } from './helpers/fixtures'
import { loginAsSuperAdmin, loginAsRegularUserViaApi, loginAsRegularUser, BASE_URL } from './helpers/auth-helpers'
import { navigateToRoot, navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestClassOption,
  createTestLesson,
  createTestBooking,
  getPayloadInstance,
} from './helpers/data-helpers'

test.describe('App smoke', () => {
  // Serial mode: avoid cross-test interference (lesson IDs, session); fixes "pass in isolation, fail in suite".
  test.describe.configure({ timeout: 90_000, mode: 'serial' })

  test('homepage and tenants listing load', async ({ page }) => {
    await navigateToRoot(page)
    const url = new URL(page.url())
    expect(url.hostname).toBe('localhost')

    await navigateToRoot(page, '/tenants')
    expect(page.url()).toContain('/tenants')
    await expect(page.locator('body')).toBeVisible()
  })

  test('checkout pay-at-door: full flow (quantity, Book, success)', async ({
    page,
    testData,
  }) => {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    const requestFailures: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => pageErrors.push(err?.message || String(err)))
    page.on('requestfailed', (req) => {
      const failure = req.failure()
      requestFailures.push(`${req.method()} ${req.url()}${failure?.errorText ? ` — ${failure.errorText}` : ''}`)
    })

    const payload = await getPayloadInstance()
    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const w = testData.workerIndex

    if (!tenantId || !tenantSlug) throw new Error('Tenant required')

    const co = await createTestClassOption(tenantId, 'Smoke Pay at Door', 5, undefined, w)
    // Do not set paymentMethods (no drop-in, no class pass). Omitting allowedClassPasses avoids
    // touching the dropped column (migration 20260210); class option stays pay-at-door.

    const start = new Date()
    start.setDate(start.getDate() + 2)
    start.setHours(12, 0, 0, 0)
    const end = new Date(start)
    end.setHours(13, 0, 0, 0)
    const lesson = await createTestLesson(tenantId, co.id, start, end, undefined, true)

    // Use subdomain-aware login and navigation (preserves auth across subdomain)
    await loginAsRegularUser(page, 1, testData.users.user1.email, 'password', { tenantSlug })
    await navigateToTenant(page, tenantSlug, `/bookings/${lesson.id}`)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

    await expect(page.getByText(/select quantity/i).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/number of slots/i).first()).toBeVisible()
    // QuantitySelector uses +/- buttons; default quantity is 1. Just click Book.
    const bookBtn = page.getByRole('button', { name: /^book\b/i }).first()
    await expect(bookBtn).toBeVisible()
    await expect(bookBtn).toBeEnabled()

    // Hydration guard: ensure client-side interactivity is live before booking.
    // If the page isn't hydrated, clicking "Book" (type="button") won't trigger anything.
    const incQtyBtn = page.getByRole('button', { name: /increase quantity/i }).first()
    await incQtyBtn.click()
    try {
      await expect(bookBtn).toHaveText(/book\s+2\s+slot/i, { timeout: 10000 })
    } catch (err) {
      const debug = [
        'Hydration guard failed: quantity did not update after clicking "Increase quantity".',
        consoleErrors.length ? `Console errors:\n- ${consoleErrors.join('\n- ')}` : 'Console errors: (none captured)',
        pageErrors.length ? `Page errors:\n- ${pageErrors.join('\n- ')}` : 'Page errors: (none captured)',
        requestFailures.length
          ? `Request failures:\n- ${requestFailures.join('\n- ')}`
          : 'Request failures: (none captured)',
      ].join('\n\n')
      throw new Error(`${debug}\n\nOriginal error:\n${String(err)}`)
    }

    // IMPORTANT: set up the waiter before clicking, otherwise a fast request can be missed
    // and the test becomes flaky.
    const createBookingsRequest = page.waitForRequest(
      (request) => {
        if (request.method() !== 'POST') return false
        const url = request.url()
        if (!url.includes('/api/trpc')) return false
        if (url.includes('bookings.createBookings')) return true
        const body = request.postData() ?? ''
        return body.includes('bookings.createBookings')
      },
      { timeout: 15000 },
    )

    await Promise.all([createBookingsRequest, bookBtn.click()])

    // Success page: wait for visible confirmation (resilient to redirect path / vs /success).
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/your booking has been confirmed/i)).toBeVisible()
  })

  test('checkout Stripe-enabled: fee breakdown visible (no payment submission)', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const w = testData.workerIndex

    if (!tenantId || !tenantSlug) throw new Error('Tenant required')

    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: `acct_smoke_${tenantId}`,
      },
      overrideAccess: true,
    })

    const dropIn = await payload.create({
      collection: 'drop-ins',
      data: {
        name: `Smoke Drop-in ${tenantId}-w${w}-${Date.now()}`,
        isActive: true,
        price: 1000,
        adjustable: true,
        paymentMethods: ['card'],
        tenant: tenantId,
      },
      overrideAccess: true,
    }) as { id: number }
    const co = await createTestClassOption(tenantId, 'Smoke Stripe UI', 5, undefined, w)
    // Use only allowedDropIn; omit allowedClassPasses to avoid touching dropped column / rels (see migration 20260210).
    await payload.update({
      collection: 'class-options',
      id: co.id,
      data: { paymentMethods: { allowedDropIn: dropIn.id } },
      overrideAccess: true,
    })

    const start = new Date()
    start.setDate(start.getDate() + 2)
    start.setHours(14, 0, 0, 0)
    const end = new Date(start)
    end.setHours(15, 0, 0, 0)
    const lesson = await createTestLesson(tenantId, co.id, start, end, undefined, true)
    // Ensure lesson is for the same tenant we navigate to (host derives tenant from subdomain).
    const lessonTenantId = typeof lesson.tenant === 'object' && lesson.tenant !== null ? (lesson.tenant as { id: number }).id : lesson.tenant
    if (lessonTenantId !== tenantId) {
      throw new Error(`Test setup: lesson ${lesson.id} tenant ${lessonTenantId} !== navigation tenant ${tenantId}. Use same testData.tenants[0].`)
    }

    // API login + tenant-scoped cookies so session is reliably sent on tenant subdomain (same as class-pass test).
    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password', { tenantSlug })

    // Warm-up: hit tenant root so the app resolves the tenant and session is accepted before the booking page.
    await navigateToTenant(page, tenantSlug, '/')
    await page.waitForLoadState('domcontentloaded').catch(() => null)
    const tenantNotFound = await page.getByText(/tenant not found/i).isVisible().catch(() => false)
    if (tenantNotFound) {
      throw new Error(
        `Tenant "${tenantSlug}" not found when loading tenant root. Lesson ${lesson.id}. ` +
          `App and test must use the same DB.`
      )
    }
    await page.waitForURL((u) => u.pathname === '/home' || u.pathname === '/', { timeout: 10000 }).catch(() => null)

    await navigateToTenant(page, tenantSlug, `/bookings/${lesson.id}`)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

    // Wait for booking page: either Payment Methods (success) or error (fail fast with clear message).
    const result = await Promise.race([
      page.getByText(/payment methods/i).first().waitFor({ state: 'visible', timeout: 15000 }).then(() => 'success'),
      page.getByText(/something went wrong/i).waitFor({ state: 'visible', timeout: 15000 }).then(() => 'error'),
    ]).catch(() => 'timeout')

    if (result === 'error') {
      throw new Error(`Server error on booking page. Lesson ${lesson.id}, tenant ${tenantSlug}. Check server logs.`)
    }
    if (result === 'timeout') {
      const url = page.url()
      const body = await page.textContent('body').catch(() => '')
      throw new Error(
        `Timeout waiting for Stripe booking page. Lesson ${lesson.id}, tenant ${tenantSlug}. URL: ${url}. Body: ${body?.slice(0, 300) ?? 'none'}`
      )
    }

    const paymentMethodsEl = page.getByText(/payment methods/i).first()
    await paymentMethodsEl.scrollIntoViewIfNeeded().catch(() => null)
    await expect(paymentMethodsEl).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('tab', { name: /drop-?in/i })).toBeVisible()
    // Fee breakdown visible in drop-in tab
    await page.getByRole('tab', { name: /drop-?in/i }).click()
    await expect(page.getByTestId('booking-fee-breakdown')).toBeVisible({ timeout: 10000 })
  })

  test('checkout class-pass-only: booking page loads with quantity and form', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const w = testData.workerIndex

    if (!tenantId || !tenantSlug) throw new Error('Tenant required')

    // Class-option payment methods (including class passes) require tenant Stripe Connect to be active.
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: `acct_cp_only_${tenantId}`,
      },
      overrideAccess: true,
    })

    const cpType = await payload.create({
      collection: 'class-pass-types',
      draft: false,
      data: {
        name: 'Smoke CP Only',
        slug: `smoke-cp-only-${tenantId}-w${w}-${Date.now()}`,
        quantity: 5,
        tenant: tenantId,
        status: 'active',
        allowMultipleBookingsPerLesson: true,
      },
      overrideAccess: true,
    }) as { id: number }
    const co = await createTestClassOption(tenantId, 'Smoke Class Pass Only', 5, undefined, w)
    await payload.update({
      collection: 'class-options',
      id: co.id,
      data: {
        paymentMethods: {
          allowedClassPasses: [cpType.id],
        },
      },
      overrideAccess: true,
    })

    const start = new Date()
    start.setDate(start.getDate() + 2)
    start.setHours(16, 0, 0, 0)
    const end = new Date(start)
    end.setHours(17, 0, 0, 0)
    const lesson = await createTestLesson(tenantId, co.id, start, end, undefined, true)
    await new Promise((r) => setTimeout(r, 400))

    // API login + tenant-scoped cookies (same as manage test) so session is reliably sent on tenant subdomain.
    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password', { tenantSlug })

    // Warm-up: hit tenant root so the app resolves the tenant once. If the app uses a different DB
    // or tenant doesn't exist, we get 404 here instead of after a redirect from the booking page.
    await navigateToTenant(page, tenantSlug, '/')
    await page.waitForLoadState('domcontentloaded').catch(() => null)
    const tenantNotFound = await page.getByText(/tenant not found/i).isVisible().catch(() => false)
    if (tenantNotFound) {
      throw new Error(
        `Tenant "${tenantSlug}" not found when loading tenant root. Lesson ${lesson.id}. ` +
          `App and test must use the same DB: set DATABASE_URI in apps/atnd-me/.env and run e2e with a fresh server ` +
          `(CI=1 or close any existing dev server so Playwright starts it with the same env).`
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
        `Booking page redirected away. Lesson ${lesson.id}, tenant ${tenantSlug}. ` +
          `Expected ${bookingPath}, got ${currentPath}. ` +
          `Check server logs for [createBookingPage] or getByIdForBooking (NOT_FOUND, tenant mismatch, or bookingStatus closed).`
      )
    }

    // Wait for booking page: success, error, or tenant 404 (fail fast with clear message).
    const result = await Promise.race([
      page.getByText(/select quantity/i).first().waitFor({ state: 'visible', timeout: 15000 }).then(() => 'success'),
      page.getByText(/something went wrong/i).waitFor({ state: 'visible', timeout: 15000 }).then(() => 'error'),
      page.getByText(/tenant not found/i).waitFor({ state: 'visible', timeout: 15000 }).then(() => 'tenant_not_found'),
    ]).catch(() => 'timeout')

    if (result === 'error') {
      throw new Error(`Server error on booking page. Lesson ${lesson.id}, tenant ${tenantSlug}. Check server logs.`)
    }
    if (result === 'tenant_not_found') {
      throw new Error(
        `Tenant "${tenantSlug}" not found on subdomain. Lesson ${lesson.id}. ` +
          `Ensure testData.tenants[0].slug matches the subdomain and the app uses the same DB as the test (e.g. same DATABASE_URI).`
      )
    }
    if (result === 'timeout') {
      const url = page.url()
      const hasHome = /\/home$/.test(new URL(url).pathname)
      const body = await page.textContent('body').catch(() => '')
      const hint = hasHome
        ? ' Redirected to /home — booking page likely failed (lesson not found or tenant mismatch), then root redirected to /home.'
        : ''
      throw new Error(
        `Timeout waiting for class-pass booking page. Lesson ${lesson.id}, tenant ${tenantSlug}. ` +
          `Current URL: ${url}.${hint} Body preview: ${body?.slice(0, 300) ?? 'none'}`
      )
    }

    await expect(page.getByText(/number of slots/i).first()).toBeVisible()
    // Class-pass-only: either Book (or confirm) button, or "No payment methods" when user has no pass
    const bookBtn = page.getByRole('button', { name: /book|confirm/i }).first()
    const noPaymentMsg = page.getByText(/no payment methods are available/i)
    await Promise.race([
      bookBtn.waitFor({ state: 'visible', timeout: 5000 }),
      noPaymentMsg.waitFor({ state: 'visible', timeout: 5000 }),
    ])
  })

  test('manage bookings: navigate to manage when 2+ bookings, manage UI visible', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const user1 = testData.users.user1
    const w = testData.workerIndex

    if (!tenantId || !tenantSlug || !user1) throw new Error('Tenant and user required')

    const co = await createTestClassOption(tenantId, 'Smoke Manage', 10, undefined, w)
    // No paymentMethods update needed for manage flow; avoid touching dropped column (migration 20260210).

    const start = new Date()
    start.setDate(start.getDate() + 2)
    start.setHours(10, 0, 0, 0)
    const end = new Date(start)
    end.setHours(11, 0, 0, 0)
    const lesson = await createTestLesson(tenantId, co.id, start, end, undefined, true)

    await createTestBooking(user1.id, lesson.id, 'confirmed')
    await createTestBooking(user1.id, lesson.id, 'confirmed')

    // API login then copy session to tenant subdomain so manage route receives auth (avoids UI form posting to main domain and cookie not sent on tenant).
    await loginAsRegularUserViaApi(page, user1.email, 'password', { tenantSlug })
    await navigateToTenant(page, tenantSlug, `/bookings/${lesson.id}/manage`)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

    await expect(page).toHaveURL(new RegExp(`/bookings/${lesson.id}/manage`), { timeout: 10000 })
    // In full suite, session can be lost; fail fast if we landed on login instead of manage content.
    const onLoginPage = await page.getByText(/sign in|enter your email/i).first().isVisible().catch(() => false)
    if (onLoginPage) {
      throw new Error(
        `Manage page required login. Lesson ${lesson.id}, tenant ${tenantSlug}. ` +
          `Session may not have persisted (run with mode: 'serial' or check auth cookie domain).`
      )
    }
    await expect(
      page.getByText(/your bookings|update booking quantity/i).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('admin panel: super admin can access dashboard', async ({ page, testData, request }) => {
    await loginAsSuperAdmin(page, testData.users.superAdmin.email, { request })
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' })
    await page
      .waitForURL(
        (url) => url.pathname.startsWith('/admin') && !url.pathname.startsWith('/admin/login'),
        { timeout: 15000 }
      )
      .catch(() => {
        if (page.url().includes('/admin/login')) {
          throw new Error('Super admin redirected to login')
        }
      })
    expect(page.url()).toContain('/admin')
    expect(page.url()).not.toContain('/admin/login')
  })
})
// test comment
// test
