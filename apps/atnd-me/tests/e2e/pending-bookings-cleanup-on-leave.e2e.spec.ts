/**
 * E2E: Pending bookings are removed when the user leaves the booking checkout page.
 * - With payment methods: user creates pending via manage (increase quantity, Update Bookings), leaves, returns -> pending gone.
 * - Without payment methods: user has pending (created via API), visits manage, leaves, returns -> pending cancelled.
 */
import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { loginAsRegularUser } from './helpers/auth-helpers'
import {
  createTestClassOption,
  createTestLesson,
  createTestBooking,
  getPayloadInstance,
} from './helpers/data-helpers'

test.describe('Pending bookings cleanup when user leaves checkout', () => {
  test.describe('lesson WITH payment methods', () => {
    test('leaving manage page after creating pending cancels them; return shows only confirmed', async ({
      page,
      testData,
    }) => {
      const payload = await getPayloadInstance()
      const workerIndex = testData.workerIndex
      const tenant = testData.tenants[0]!
      const user = testData.users.user1

      // Tenant must have Stripe Connect so payment methods are shown
      await payload.update({
        collection: 'tenants',
        id: tenant.id,
        data: {
          stripeConnectOnboardingStatus: 'active',
          stripeConnectAccountId: `acct_leave_${tenant.id}_w${workerIndex}`,
        },
        overrideAccess: true,
      })

      const dropIn = (await payload.create({
        collection: 'drop-ins',
        data: {
          name: `Leave Cleanup Drop-in ${tenant.id}-w${workerIndex}-${Date.now()}`,
          isActive: true,
          price: 1000,
          adjustable: true,
          paymentMethods: ['card'],
          tenant: tenant.id,
        },
        overrideAccess: true,
      })) as { id: number }

      const classOption = await createTestClassOption(
        tenant.id,
        'Leave Cleanup With PM',
        10,
        undefined,
        workerIndex
      )
      await payload.update({
        collection: 'class-options',
        id: classOption.id,
        data: { paymentMethods: { allowedDropIn: dropIn.id } },
        overrideAccess: true,
      })

      const startTime = new Date()
      startTime.setHours(10, 0, 0, 0)
      startTime.setDate(startTime.getDate() + 1 + workerIndex)
      const endTime = new Date(startTime)
      endTime.setHours(11, 0, 0, 0)

      const lesson = await createTestLesson(
        tenant.id,
        classOption.id,
        startTime,
        endTime,
        undefined,
        true
      )

      // One confirmed booking so user lands on manage and can increase quantity
      await createTestBooking(user.id, lesson.id, 'confirmed')

      await loginAsRegularUser(page, 1, user.email, 'password', {
        tenantSlug: tenant.slug,
      })
      // CI runners are slower; allow more time for session to stabilize so manage page receives auth.
      const sessionStabilizeMs = process.env.CI ? 3000 : 1500
      await page.waitForTimeout(sessionStabilizeMs)

      const managePath = `/bookings/${lesson.id}/manage`
      const errorHeading = page.getByRole('heading', { name: /booking page error/i })
      const quantityViewHeading = page.getByText(/update booking quantity/i).first()
      const raceTimeout = process.env.CI ? 15000 : 10000

      const gotoManageAndRace = async () => {
        await navigateToTenant(page, tenant.slug, managePath)
        if (page.url().includes('/auth/sign-in')) {
          await loginAsRegularUser(page, 1, user.email, 'password', {
            tenantSlug: tenant.slug,
          })
          await page.waitForTimeout(sessionStabilizeMs)
          await navigateToTenant(page, tenant.slug, managePath)
        }
        await expect(page).toHaveURL(new RegExp(`/bookings/${lesson.id}/manage`), {
          timeout: 15000,
        })
        await page.waitForLoadState('load').catch(() => null)
        return Promise.race([
          quantityViewHeading.waitFor({ state: 'visible', timeout: raceTimeout }).then(() => 'success' as const),
          errorHeading.waitFor({ state: 'visible', timeout: raceTimeout }).then(() => 'error' as const),
        ])
      }

      let outcome = await gotoManageAndRace()
      if (outcome === 'error') {
        await loginAsRegularUser(page, 1, user.email, 'password', {
          tenantSlug: tenant.slug,
        })
        await page.waitForTimeout(process.env.CI ? 3000 : 2000)
        outcome = await gotoManageAndRace()
      }
      if (outcome === 'error') {
        throw new Error(
          'Manage page showed "Booking page error" instead of quantity view. Check server/session for this lesson.'
        )
      }

      // Quantity view: 1 booking
      await expect(page.getByTestId('booking-quantity')).toHaveText('1', {
        timeout: 5000,
      })

      // Increase quantity to 2 and click Update Bookings -> creates 1 pending, shows Complete Payment
      await page.getByRole('button', { name: /increase quantity/i }).click()
      await expect(page.getByTestId('booking-quantity')).toHaveText('2', {
        timeout: 5000,
      })
      await page.getByRole('button', { name: /update bookings/i }).click()

      // Wait for checkout view (pending created). Either the "Complete Payment" card or "pending booking" text appears; accept either.
      const completePaymentHeading = page.getByRole('heading', { name: /complete payment/i })
      const pendingBookingText = page.getByText(/pending booking/i).first()
      await Promise.race([
        completePaymentHeading.waitFor({ state: 'visible', timeout: 22000 }),
        pendingBookingText.waitFor({ state: 'visible', timeout: 22000 }),
      ])

      // Leave the page (navigate to home) – cleanup should cancel pending
      await navigateToTenant(page, tenant.slug, '/')
      await expect(page).not.toHaveURL(new RegExp(`/bookings/${lesson.id}/manage`))

      // Return to manage page
      await navigateToTenant(page, tenant.slug, managePath)
      await expect(page).toHaveURL(new RegExp(`/bookings/${lesson.id}/manage`), {
        timeout: 15000,
      })

      // Should see quantity view with only 1 (confirmed); pending were removed on leave (CI: allow longer for re-render).
      const quantityViewTimeout = process.env.CI ? 15000 : 10000
      await expect(
        page.getByText(/update booking quantity/i).first()
      ).toBeVisible({ timeout: quantityViewTimeout })
      await expect(page.getByTestId('booking-quantity')).toHaveText('1', {
        timeout: 8000,
      })
      await expect(page.getByText(/complete payment/i)).not.toBeVisible()

      // DB: only 1 non-cancelled booking for this user/lesson
      const bookings = await payload.find({
        collection: 'bookings',
        where: {
          lesson: { equals: lesson.id },
          user: { equals: user.id },
        },
        depth: 0,
        limit: 20,
        overrideAccess: true,
      })
      const active = (bookings?.docs ?? []).filter(
        (b: { status?: string }) => String(b?.status ?? '').toLowerCase() !== 'cancelled'
      )
      expect(active.length).toBe(1)
      expect(active[0]?.status).toBe('confirmed')
    })
  })

  test.describe('lesson WITHOUT payment methods', () => {
    test('leaving manage page with pending (from API) cancels them; return shows only confirmed', async ({
      page,
      testData,
    }) => {
      const payload = await getPayloadInstance()
      const workerIndex = testData.workerIndex
      const tenant = testData.tenants[0]!
      const user = testData.users.user2 ?? testData.users.user1

      // Class option with no payment methods
      const classOption = await createTestClassOption(
        tenant.id,
        'Leave Cleanup No PM',
        10,
        undefined,
        workerIndex
      )

      const startTime = new Date()
      startTime.setHours(12, 0, 0, 0)
      startTime.setDate(startTime.getDate() + 1 + workerIndex)
      const endTime = new Date(startTime)
      endTime.setHours(13, 0, 0, 0)

      const lesson = await createTestLesson(
        tenant.id,
        classOption.id,
        startTime,
        endTime,
        undefined,
        true
      )

      // 1 confirmed + 1 pending (simulate abandoned checkout or API-created pending)
      await createTestBooking(user.id, lesson.id, 'confirmed')
      await createTestBooking(user.id, lesson.id, 'pending')

      await loginAsRegularUser(page, 1, user.email, 'password', {
        tenantSlug: tenant.slug,
      })
      const sessionStabilizeMs = process.env.CI ? 3000 : 1500
      await page.waitForTimeout(sessionStabilizeMs)

      const managePath = `/bookings/${lesson.id}/manage`
      const errorHeading = page.getByRole('heading', { name: /booking page error/i })
      const completePayment = page.getByText(/complete payment/i).first()
      const raceTimeout = process.env.CI ? 15000 : 10000

      const gotoManageAndRace = async () => {
        await navigateToTenant(page, tenant.slug, managePath)
        if (page.url().includes('/auth/sign-in')) {
          await loginAsRegularUser(page, 1, user.email, 'password', {
            tenantSlug: tenant.slug,
          })
          await page.waitForTimeout(sessionStabilizeMs)
          await navigateToTenant(page, tenant.slug, managePath)
        }
        await expect(page).toHaveURL(new RegExp(`/bookings/${lesson.id}/manage`), {
          timeout: 15000,
        })
        await page.waitForLoadState('load').catch(() => null)
        return Promise.race([
          completePayment.waitFor({ state: 'visible', timeout: raceTimeout }).then(() => 'success' as const),
          errorHeading.waitFor({ state: 'visible', timeout: raceTimeout }).then(() => 'error' as const),
        ])
      }

      let outcome = await gotoManageAndRace()
      if (outcome === 'error') {
        await loginAsRegularUser(page, 1, user.email, 'password', {
          tenantSlug: tenant.slug,
        })
        await page.waitForTimeout(process.env.CI ? 3000 : 2000)
        outcome = await gotoManageAndRace()
      }
      if (outcome === 'error') {
        throw new Error(
          'Manage page showed "Booking page error" instead of checkout. Check server/session for this lesson.'
        )
      }

      await expect(page.getByText(/pending booking/i).first()).toBeVisible({ timeout: 8000 })

      // Leave the page – cleanup should cancel pending
      await navigateToTenant(page, tenant.slug, '/')
      await expect(page).not.toHaveURL(new RegExp(`/bookings/${lesson.id}/manage`))

      // Return to manage page
      await navigateToTenant(page, tenant.slug, managePath)
      await expect(page).toHaveURL(new RegExp(`/bookings/${lesson.id}/manage`), {
        timeout: 15000,
      })

      // Should see only 1 booking (pending was cancelled on leave)
      const quantityViewTimeout = process.env.CI ? 15000 : 10000
      await expect(
        page.getByText(/update booking quantity/i).first()
      ).toBeVisible({ timeout: quantityViewTimeout })
      await expect(page.getByTestId('booking-quantity')).toHaveText('1', {
        timeout: 8000,
      })

      // DB: only 1 non-cancelled booking
      const bookings = await payload.find({
        collection: 'bookings',
        where: {
          lesson: { equals: lesson.id },
          user: { equals: user.id },
        },
        depth: 0,
        limit: 20,
        overrideAccess: true,
      })
      const active = (bookings?.docs ?? []).filter(
        (b: { status?: string }) => String(b?.status ?? '').toLowerCase() !== 'cancelled'
      )
      expect(active.length).toBe(1)
      expect(active[0]?.status).toBe('confirmed')
    })
  })
})
