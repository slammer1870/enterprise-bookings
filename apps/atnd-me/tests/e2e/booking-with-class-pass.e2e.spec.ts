/**
 * Phase 4.6 – E2E: Booking page for a lesson that allows class passes; user with valid pass
 * sees Class pass tab; confirm with class pass redirects to success; booking confirmed and pass decremented.
 */
import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestClassOption,
  createTestLesson,
  getPayloadInstance,
} from './helpers/data-helpers'

async function openBookingPage(args: {
  page: Parameters<typeof test>[0]['page']
  tenantSlug: string
  lessonId: number
}) {
  const { page, tenantSlug, lessonId } = args

  await navigateToTenant(page, tenantSlug, '/')
  await page.waitForLoadState('domcontentloaded').catch(() => null)
  await navigateToTenant(page, tenantSlug, `/bookings/${lessonId}`)
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

  await expect(
    page.getByText(/select quantity|number of slots|book|payment methods/i).first()
  ).toBeVisible({ timeout: 15000 })
}

async function openManagePage(args: {
  page: Parameters<typeof test>[0]['page']
  tenantSlug: string
  lessonId: number
}) {
  const { page, tenantSlug, lessonId } = args
  const manageHeading = page.getByText(/update booking quantity/i).first()
  const errorHeading = page.getByRole('heading', { name: /booking page error/i })

  for (let attempt = 0; attempt < 3; attempt++) {
    await navigateToTenant(page, tenantSlug, `/bookings/${lessonId}/manage`)
    await page.waitForLoadState('load').catch(() => null)

    const outcome = await Promise.race([
      manageHeading.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'success' as const),
      errorHeading.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'error' as const),
    ]).catch(() => null)

    if (outcome === 'success') return
    if (outcome === 'error' && attempt < 2) {
      const tryAgain = page.getByRole('button', { name: /try again/i })
      if (await tryAgain.isVisible().catch(() => false)) {
        await tryAgain.click()
      }
      await page.waitForTimeout(process.env.CI ? 3000 : 1500)
    }
  }

  throw new Error(`Failed to load manage page for lesson ${lessonId}. URL: ${page.url()}`)
}

test.describe('Booking with class pass (Phase 4.6)', () => {
  test.describe.configure({ timeout: 90_000, mode: 'serial' })

  test('lesson with class pass only: user with valid pass sees Class pass tab and can confirm', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const w = testData.workerIndex

    if (!tenantId || !tenantSlug) throw new Error('Tenant required')

    // Class pass payment-method gating only requires the tenant to be marked active.
    // Avoid attaching a fake Connect account so tests do not attempt real Stripe calls.
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: null,
      },
      overrideAccess: true,
    })

    const co = await createTestClassOption(tenantId, 'Class Pass Only', 5, undefined, w)
    const cpt = await payload.create({
      collection: 'class-pass-types',
      data: {
        name: `E2E 5-Pack w${w} ${Date.now()}`,
        slug: `e2e-5pack-${tenantId}-${Date.now()}`,
        quantity: 5,
        tenant: tenantId,
        priceInformation: { price: 29.99 },
        skipSync: true,
        stripeProductId: `prod_test_${tenantId}_${w}_${Date.now()}`,
      },
      overrideAccess: true,
    }) as { id: number }
    await payload.update({
      collection: 'event-types',
      id: co.id,
      data: { paymentMethods: { allowedClassPasses: [cpt.id] } },
      overrideAccess: true,
    })

    const future = new Date(Date.now() + 86400000 * 30)
    const pass = await payload.create({
      collection: 'class-passes',
      data: {
        user: testData.users.user1.id,
        tenant: tenantId,
        type: cpt.id,
        quantity: 5,
        expirationDate: future.toISOString().slice(0, 10),
        purchasedAt: new Date().toISOString(),
        price: 2999,
        status: 'active',
      },
      overrideAccess: true,
    }) as { id: number }

    const start = new Date()
    start.setDate(start.getDate() + 2)
    start.setHours(14, 0, 0, 0)
    const end = new Date(start)
    end.setHours(15, 0, 0, 0)
    const lesson = await createTestLesson(tenantId, co.id, start, end, undefined, true)

    await new Promise((r) => setTimeout(r, 600))

    // API login + tenant-scoped cookies so session is sent on tenant subdomain (avoids "Booking page error" from unauthenticated server render).
    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password', { tenantSlug })
    await navigateToTenant(page, tenantSlug, '/')
    await page.waitForLoadState('domcontentloaded').catch(() => null)
    await navigateToTenant(page, tenantSlug, `/bookings/${lesson.id}`)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

    await expect(
      page.getByText(/select quantity|number of slots|book|payment methods/i).first()
    ).toBeVisible({ timeout: 15000 })
    const qty = page.getByRole('button', { name: /increase quantity/i }).first()
    await qty.click().catch(() => null)

    // Wait for payment methods to resolve (getValidClassPassesForLesson) so Class pass tab can appear
    await page.waitForTimeout(2000)
    const classPassTab = page.getByRole('tab', { name: /class pass/i })
    await expect(classPassTab).toBeVisible({ timeout: 15000 })

    await classPassTab.click()
    await expect(page.getByText(/use this pass|confirm with class pass|remaining/i).first()).toBeVisible({ timeout: 5000 })

    const confirmBtn = page.getByRole('button', { name: /confirm with class pass|book|use pass/i }).first()
    await expect(confirmBtn).toBeVisible()
    await confirmBtn.click()

    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/your booking has been confirmed/i)).toBeVisible()

    await expect
      .poll(async () => {
        const passAfter = await payload.findByID({
          collection: 'class-passes',
          id: pass.id,
          depth: 0,
          overrideAccess: true,
        }) as { quantity: number }

        return passAfter.quantity
      }, { timeout: 10000 })
      .toBe(3)
  })

  test('user with no class pass sees buy option, purchases one, and completes booking', async ({
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
        stripeConnectAccountId: null,
      },
      overrideAccess: true,
    })

    // Class pass type with priceJSON so "Buy pass" button appears
    const cptName = `E2E Buy+Book 5-Pack w${w} ${Date.now()}`
    const co = await createTestClassOption(tenantId, 'Buy And Book Pass', 5, undefined, w)
    const cpt = await payload.create({
      collection: 'class-pass-types',
      data: {
        name: cptName,
        slug: `e2e-buy-book-${tenantId}-${w}-${Date.now()}`,
        quantity: 5,
        tenant: tenantId,
        priceInformation: { price: 29.99 },
        priceJSON: JSON.stringify({ id: `price_test_buy_book_${tenantId}_${w}_${Date.now()}` }),
        skipSync: true,
        stripeProductId: `prod_test_buy_book_${tenantId}_${w}_${Date.now()}`,
      },
      overrideAccess: true,
    }) as { id: number }

    await payload.update({
      collection: 'event-types',
      id: co.id,
      data: { paymentMethods: { allowedClassPasses: [cpt.id] } },
      overrideAccess: true,
    })

    const start = new Date()
    start.setDate(start.getDate() + 2)
    start.setHours(18, 0, 0, 0)
    const end = new Date(start)
    end.setHours(19, 0, 0, 0)
    const lesson = await createTestLesson(tenantId, co.id, start, end, undefined, true)

    await new Promise((r) => setTimeout(r, 600))

    // ── Step 1: user with no passes sees "Buy a class pass" ──────────────────
    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password', { tenantSlug })
    await navigateToTenant(page, tenantSlug, '/')
    await page.waitForLoadState('domcontentloaded').catch(() => null)
    await navigateToTenant(page, tenantSlug, `/bookings/${lesson.id}`)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

    await expect(
      page.getByText(/select quantity|number of slots|book|payment methods/i).first()
    ).toBeVisible({ timeout: 15000 })

    const qtyIncreaseBtn = page.getByRole('button', { name: /increase quantity/i }).first()
    await qtyIncreaseBtn.click().catch(() => null)
    await page.waitForTimeout(2000)

    const classPassTab = page.getByRole('tab', { name: /class pass/i })
    await expect(classPassTab).toBeVisible({ timeout: 15000 })
    await classPassTab.click()

    await expect(page.getByText(/buy a class pass/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /buy pass/i })).toBeVisible({ timeout: 5000 })

    // ── Step 2: simulate the Stripe checkout completing (webhook creates pass) ─
    const future = new Date(Date.now() + 86400000 * 365)
    const purchasedPass = await payload.create({
      collection: 'class-passes',
      data: {
        user: testData.users.user1.id,
        tenant: tenantId,
        type: cpt.id,
        quantity: 5,
        expirationDate: future.toISOString().slice(0, 10),
        purchasedAt: new Date().toISOString().slice(0, 10),
        price: 2999,
        status: 'active',
      },
      overrideAccess: true,
    }) as { id: number }

    // ── Step 3: return to booking page (as if redirected from Stripe success) ─
    await navigateToTenant(page, tenantSlug, `/bookings/${lesson.id}`)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

    await expect(
      page.getByText(/select quantity|number of slots|book|payment methods/i).first()
    ).toBeVisible({ timeout: 15000 })
    await qtyIncreaseBtn.click().catch(() => null)
    await page.waitForTimeout(2000)

    // ── Step 4: class pass tab now shows the purchased pass ───────────────────
    await expect(classPassTab).toBeVisible({ timeout: 15000 })
    await classPassTab.click()
    await expect(
      page.getByText(/use this pass|remaining|confirm with class pass/i).first()
    ).toBeVisible({ timeout: 10000 })
    // "Buy a class pass" section should NOT be primary; valid pass is shown
    await expect(page.getByText(/5 credit/i).first()).toBeVisible({ timeout: 5000 })

    // ── Step 5: confirm booking with the purchased pass ───────────────────────
    const usePassBtn = page
      .getByRole('button', { name: /use this pass|confirm with class pass/i })
      .first()
    await expect(usePassBtn).toBeVisible()
    await usePassBtn.click()

    // ── Step 6: verify booking confirmed ─────────────────────────────────────
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(/your booking has been confirmed/i)).toBeVisible()

    // Verify class pass was decremented (5 → 3: quantity=2 was booked)
    await expect
      .poll(
        async () => {
          const passAfter = (await payload.findByID({
            collection: 'class-passes',
            id: purchasedPass.id,
            depth: 0,
            overrideAccess: true,
          })) as { quantity: number }
          return passAfter.quantity
        },
        { timeout: 10000 },
      )
      .toBe(3)
  })

  test('lesson with class pass only: user without a valid pass can buy an allowed class pass', async ({
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
        stripeConnectAccountId: null,
      },
      overrideAccess: true,
    })

    const co = await createTestClassOption(tenantId, 'Class Pass Only No Valid Pass', 5, undefined, w)
    const cpt = await payload.create({
      collection: 'class-pass-types',
      data: {
        name: `E2E No Pass 5-Pack w${w} ${Date.now()}`,
        slug: `e2e-no-pass-5pack-${tenantId}-${Date.now()}`,
        quantity: 5,
        tenant: tenantId,
        priceInformation: { price: 29.99 },
        priceJSON: JSON.stringify({ id: `price_test_no_pass_${tenantId}_${w}_${Date.now()}` }),
        skipSync: true,
        stripeProductId: `prod_test_no_pass_${tenantId}_${w}_${Date.now()}`,
      },
      overrideAccess: true,
    }) as { id: number }

    await payload.update({
      collection: 'event-types',
      id: co.id,
      data: { paymentMethods: { allowedClassPasses: [cpt.id] } },
      overrideAccess: true,
    })

    const start = new Date()
    start.setDate(start.getDate() + 2)
    start.setHours(16, 0, 0, 0)
    const end = new Date(start)
    end.setHours(17, 0, 0, 0)
    const lesson = await createTestLesson(tenantId, co.id, start, end, undefined, true)

    await new Promise((r) => setTimeout(r, 600))

    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password', { tenantSlug })
    await navigateToTenant(page, tenantSlug, '/')
    await page.waitForLoadState('domcontentloaded').catch(() => null)
    await navigateToTenant(page, tenantSlug, `/bookings/${lesson.id}`)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

    await expect(
      page.getByText(/select quantity|number of slots|book|payment methods/i).first()
    ).toBeVisible({ timeout: 15000 })

    await page.waitForTimeout(2000)

    const classPassTab = page.getByRole('tab', { name: /class pass/i })
    await expect(classPassTab).toBeVisible({ timeout: 15000 })
    await classPassTab.click()
    await expect(page.getByText(/buy a class pass/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /buy pass/i })).toBeVisible({ timeout: 15000 })
  })

  test('class pass balance updates for initial booking and manage-booking upgrades', async ({
    page,
    testData,
  }) => {
    test.setTimeout(150_000)

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
        stripeConnectAccountId: null,
      },
      overrideAccess: true,
    })

    const co = await createTestClassOption(tenantId, 'Manageable Class Pass', 8, undefined, w)
    const cpt = await payload.create({
      collection: 'class-pass-types',
      data: {
        name: `E2E Manageable 5-Pack w${w} ${Date.now()}`,
        slug: `e2e-manageable-5-pack-${tenantId}-${w}-${Date.now()}`,
        quantity: 5,
        allowMultipleBookingsPerLesson: true,
        tenant: tenantId,
        priceInformation: { price: 29.99 },
        skipSync: true,
        stripeProductId: `prod_manageable_${tenantId}_${w}_${Date.now()}`,
      },
      overrideAccess: true,
    }) as { id: number }

    await payload.update({
      collection: 'event-types',
      id: co.id,
      data: { paymentMethods: { allowedClassPasses: [cpt.id] } },
      overrideAccess: true,
    })

    const future = new Date(Date.now() + 86400000 * 30)
    const pass = await payload.create({
      collection: 'class-passes',
      data: {
        user: testData.users.user1.id,
        tenant: tenantId,
        type: cpt.id,
        quantity: 5,
        expirationDate: future.toISOString().slice(0, 10),
        purchasedAt: new Date().toISOString(),
        price: 2999,
        status: 'active',
      },
      overrideAccess: true,
    }) as { id: number }

    const start = new Date()
    start.setDate(start.getDate() + 2)
    start.setHours(11, 0, 0, 0)
    const end = new Date(start)
    end.setHours(12, 0, 0, 0)
    const lesson = await createTestLesson(tenantId, co.id, start, end, undefined, true)

    await new Promise((r) => setTimeout(r, 600))

    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password', { tenantSlug })

    await openBookingPage({ page, tenantSlug, lessonId: lesson.id })

    const increaseQuantity = page.getByRole('button', { name: /increase quantity/i }).first()
    await increaseQuantity.click()
    await page.waitForTimeout(2000)

    const classPassTab = page.getByRole('tab', { name: /class pass/i })
    await expect(classPassTab).toBeVisible({ timeout: 15000 })
    await classPassTab.click()

    await expect(page.getByText(/this will use 2 credits from your pass/i)).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByText(/5 credits remaining/i).first()).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: /confirm with class pass/i }).click()

    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/your booking has been confirmed/i)).toBeVisible()

    await expect
      .poll(async () => {
        const passAfterFirstBooking = await payload.findByID({
          collection: 'class-passes',
          id: pass.id,
          depth: 0,
          overrideAccess: true,
        }) as { quantity: number }

        return passAfterFirstBooking.quantity
      }, { timeout: 10000 })
      .toBe(3)

    await openManagePage({ page, tenantSlug, lessonId: lesson.id })

    const manageQuantity = page.getByTestId('booking-quantity')
    await expect(manageQuantity).toHaveText('2', { timeout: 10000 })

    const manageIncreaseQuantity = page.getByRole('button', { name: /increase quantity/i })
    await manageIncreaseQuantity.click()
    await manageIncreaseQuantity.click()
    await expect(manageQuantity).toHaveText('4', { timeout: 5000 })

    await page.getByRole('button', { name: /update bookings/i }).click()

    await expect(page.getByText(/complete payment/i).first()).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByTestId('pending-booking-quantity')).toHaveText('2', { timeout: 10000 })

    const manageClassPassTab = page.getByRole('tab', { name: /class pass/i })
    await expect(manageClassPassTab).toBeVisible({ timeout: 15000 })
    await manageClassPassTab.click()

    await expect(page.getByText(/this will use 2 credits from your pass/i)).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByText(/3 credits remaining/i).first()).toBeVisible({ timeout: 10000 })

    const confirmUpgradeRequest = page.waitForRequest(
      (request) => {
        if (request.method() !== 'POST') return false
        const url = request.url()
        if (!url.includes('/api/trpc')) return false
        if (url.includes('bookings.createBookings')) return true
        const body = request.postData() ?? ''
        return body.includes('bookings.createBookings')
      },
      { timeout: 15000 }
    )

    await Promise.all([
      confirmUpgradeRequest,
      page.getByRole('button', { name: /confirm with class pass/i }).click(),
    ])

    await expect
      .poll(async () => {
        const passAfterUpgrade = await payload.findByID({
          collection: 'class-passes',
          id: pass.id,
          depth: 0,
          overrideAccess: true,
        }) as { quantity: number }

        return passAfterUpgrade.quantity
      }, { timeout: 10000 })
      .toBe(1)

    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)
    await openManagePage({ page, tenantSlug, lessonId: lesson.id })
    await expect(page.getByTestId('booking-quantity')).toHaveText('4', { timeout: 10000 })
  })
})
