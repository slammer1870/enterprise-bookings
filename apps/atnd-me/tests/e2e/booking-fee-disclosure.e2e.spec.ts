/**
 * Step 2.7.2 – E2E: Checkout UI shows when payment methods are attached (Payment Methods / Drop-in tab).
 */
import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi, BASE_URL } from './helpers/auth-helpers'
import {
  createTestClassOption,
  createTestLesson,
} from './helpers/data-helpers'
import { getPayload } from 'payload'
import config from '@/payload.config'

test.describe('Booking fee disclosure (step 2.7.2)', () => {
  test.describe.configure({ timeout: 90_000 })
  test('checkout UI shows when payment methods are attached (Drop-in tab)', async ({
    page,
    testData,
  }) => {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    
    // Ensure payload is initialized
    await payload.db.init?.()
    
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

    // Set tenant cookie BEFORE any navigation
    await page.context().addCookies([
      {
        name: 'tenant-slug',
        value: tenantSlug,
        domain: new URL(BASE_URL).hostname,
        path: '/',
      },
    ])
    
    // Login user
    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password')
    
    // Navigate to booking page and check response
    const response = await page.goto(`${BASE_URL}/bookings/${lesson.id}`, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    
    // Verify page loaded successfully
    if (!response || response.status() !== 200) {
      const pageContent = await page.content()
      throw new Error(
        `Page failed to load: HTTP ${response?.status() || 'unknown'}\n` +
        `URL: ${BASE_URL}/bookings/${lesson.id}\n` +
        `Page content preview: ${pageContent.slice(0, 500)}`
      )
    }
    
    // Wait for network to settle
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)
    
    // Check for server error on page
    const hasServerError = await page.getByText(/application error|server-side exception/i).isVisible().catch(() => false)
    if (hasServerError) {
      const errorText = await page.textContent('body')
      throw new Error(`Server-side error detected on page:\n${errorText}`)
    }

    // Verify payment methods section is visible
    await expect(page.getByText(/payment methods/i).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('tab', { name: /drop-?in/i })).toBeVisible()
  })
})
