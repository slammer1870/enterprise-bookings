/**
 * E2E: Drop-in multi-quantity pricing applies discount tiers.
 * Verifies:
 * - User can increase quantity to 2
 * - Discount tier applies and UI shows discounted total
 * - The discounted price is what gets posted to /api/stripe/create-payment-intent
 */
import { test, expect } from './helpers/fixtures'
import { BASE_URL } from './helpers/auth-helpers'
import { createTestClassOption, createTestLesson } from './helpers/data-helpers'
import { getPayload } from 'payload'
import config from '../../src/payload.config'
import { clearTestMagicLinks, pollForTestMagicLink } from '@repo/testing-config/src/playwright'

test.describe('Drop-in multi-quantity discount', () => {
  test.describe.configure({ timeout: 90_000 })

  test('quantity-based discount applies and is sent to payment intent', async ({
    page,
    testData,
  }) => {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    await payload.db.init?.()

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
      collection: 'class-options',
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

    // Tenant routing cookie must be set before navigation.
    await page.context().addCookies([
      {
        name: 'tenant-slug',
        value: tenantSlug,
        domain: new URL(BASE_URL).hostname,
        path: '/',
      },
    ])

    const email = testData.users.user1.email
    await clearTestMagicLinks(page.request, email)

    // Request magic link via tRPC (avoids flaky UI hydration during Next dev compiles).
    const callbackURL = `${BASE_URL}/bookings/${lesson.id}`
    const res = await page.request.post(
      `${BASE_URL}/api/trpc/auth.signInMagicLink?batch=1`,
      {
        data: {
          0: {
            json: {
              email,
              callbackURL,
            },
          },
        },
      },
    )
    if (!res.ok()) {
      const text = await res.text().catch(() => '')
      throw new Error(`auth.signInMagicLink failed: ${res.status()} ${text}`)
    }

    const magicLink = await pollForTestMagicLink(page.request, email, 15, 1000)
    await page.goto(magicLink.url, { waitUntil: 'load', timeout: 60_000 })

    await page.goto(`${BASE_URL}/bookings/${lesson.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })

    await expect(page.getByText(/payment methods/i).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('tab', { name: /drop-?in/i })).toBeVisible()

    await page.getByRole('tab', { name: /drop-?in/i }).click()

    // Baseline: quantity 1 shows €10.00 total
    await expect(page.getByText(/total:/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('€10.00')).toBeVisible({ timeout: 15_000 })

    // Wait for the *discounted* payment intent request when quantity becomes 2 (price should be 18.00).
    const discountedRequestPromise = page.waitForRequest((req) => {
      if (!req.url().includes('create-payment-intent')) return false
      if (req.method() !== 'POST') return false
      try {
        const body = req.postDataJSON() as { price?: unknown }
        return body?.price === 18
      } catch {
        return false
      }
    })

    // Increase quantity to 2 (should trigger discount tier and a new payment intent creation)
    const inc = page.getByRole('button', { name: 'Increase quantity' })
    await inc.scrollIntoViewIfNeeded()
    await inc.click()

    // UI shows original total struck-through and discounted total visible
    await expect(page.getByText('€20.00')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('€18.00')).toBeVisible({ timeout: 15_000 })

    // Verify the discounted amount is what is posted to the payment intent endpoint
    const req = await discountedRequestPromise
    const body = req.postDataJSON() as { price?: unknown }
    expect(body.price).toBe(18)
  })
})

