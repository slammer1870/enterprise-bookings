import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestClassOption,
  createTestLesson,
  getPayloadInstance,
} from './helpers/data-helpers'

test.describe('Drop-in 100% promo booking', () => {
  test.describe.configure({ timeout: 90_000 })

  test('a fully discounted promo lets the user complete the booking without Stripe payment', async ({
    page,
    testData,
    request,
  }) => {
    const payload = await getPayloadInstance()

    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const userId = testData.users.user1.id
    const workerIndex = testData.workerIndex

    if (!tenantId || !tenantSlug || !userId) {
      throw new Error('Tenant or user fixture is missing for 100% promo booking test')
    }

    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: `acct_dropin_free_${tenantId}`,
      },
      overrideAccess: true,
    })

    const promoCode = `FREE${tenantId}${workerIndex}`.slice(0, 24).toUpperCase()
    await payload.create({
      collection: 'discount-codes',
      data: {
        name: `Free booking promo ${tenantId}-${workerIndex}`,
        code: promoCode,
        type: 'percentage_off',
        value: 100,
        duration: 'once',
        tenant: tenantId,
      },
      overrideAccess: true,
    })

    const dropIn = await payload.create({
      collection: 'drop-ins',
      data: {
        name: `E2E Free Drop-in ${tenantId}-${Date.now()}`,
        isActive: true,
        price: 10,
        adjustable: true,
        paymentMethods: ['card'],
        tenant: tenantId,
      },
      overrideAccess: true,
    }) as { id: number }

    const classOption = await createTestClassOption(tenantId, 'Free Promo Class', 5, undefined, workerIndex)
    await payload.update({
      collection: 'event-types',
      id: classOption.id,
      data: {
        paymentMethods: { allowedDropIn: dropIn.id },
        tenant: tenantId,
      },
      overrideAccess: true,
    })

    const startTime = new Date()
    startTime.setDate(startTime.getDate() + 1)
    startTime.setHours(12, 0, 0, 0)
    const endTime = new Date(startTime)
    endTime.setHours(13, 0, 0, 0)
    const lesson = await createTestLesson(tenantId, classOption.id, startTime, endTime, undefined, true)

    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password', {
      request,
      tenantSlug,
    })

    await navigateToTenant(page, tenantSlug, `/bookings/${lesson.id}`)
    await expect(page).toHaveURL(new RegExp(`/bookings/${lesson.id}$`), { timeout: 30_000 })
    await expect(page.getByRole('heading', { name: /payment methods/i })).toBeVisible({
      timeout: 30_000,
    })
    await page.getByRole('tab', { name: /drop-?in/i }).click()

    await page.getByLabel('Promo code').fill(promoCode)
    await page.getByRole('button', { name: /^Apply$/i }).click()
    await expect(page.getByText(/promo code applied/i)).toBeVisible({ timeout: 15_000 })

    const classPriceText = await page.getByTestId('class-price').innerText()
    const promoDiscountText = await page.getByTestId('promo-discount').innerText()
    expect(promoDiscountText).toBe(`-${classPriceText}`)
    await expect(page.getByTestId('booking-fee')).toHaveCount(0)
    await expect(page.getByTestId('total')).toHaveText('€0.00')

    await expect(page.getByText(/invalid payment request/i)).toHaveCount(0)
    await expect(page.getByTestId('complete-free-booking')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('complete-free-booking').click()

    await page.waitForURL(/\/success\?/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: /thank you!/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/your booking has been confirmed/i)).toBeVisible({ timeout: 15_000 })

    const bookings = await payload.find({
      collection: 'bookings',
      where: {
        and: [
          { lesson: { equals: lesson.id } },
          { user: { equals: Number(userId) } },
          { status: { equals: 'confirmed' } },
        ],
      },
      limit: 10,
      depth: 0,
      overrideAccess: true,
    })

    expect(bookings.totalDocs).toBe(1)
  })
})
