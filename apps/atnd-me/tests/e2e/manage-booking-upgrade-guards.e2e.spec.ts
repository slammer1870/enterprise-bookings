import { test, expect } from './helpers/fixtures'
import { loginAsRegularUser } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestBooking,
  createTestEventType,
  createTestTimeslot,
  createTestPlan,
  getPayloadInstance,
} from './helpers/data-helpers'

async function openBookingPage(args: {
  page: Parameters<typeof test>[0]['page']
  tenantSlug: string
  userEmail: string
  lessonId: number
}) {
  const { page, tenantSlug, userEmail, lessonId } = args
  const quantityHeading = page.getByText(/select quantity/i).first()
  const errorHeading = page.getByRole('heading', { name: /booking page error/i })

  for (let attempt = 0; attempt < 3; attempt++) {
    await navigateToTenant(page, tenantSlug, `/bookings/${lessonId}`)
    if (page.url().includes('/auth/sign-in')) {
      await loginAsRegularUser(page, 1, userEmail, 'password', { tenantSlug })
      await page.waitForTimeout(process.env.CI ? 3000 : 1500)
      continue
    }

    await page.waitForLoadState('load').catch(() => null)
    const outcome = await Promise.race([
      quantityHeading.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'success' as const),
      errorHeading.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'error' as const),
    ]).catch(() => null)

    if (outcome === 'success') return
    if (outcome === 'error' && attempt < 2) {
      await loginAsRegularUser(page, 1, userEmail, 'password', { tenantSlug })
      await page.waitForTimeout(process.env.CI ? 3000 : 1500)
    }
  }

  throw new Error(`Failed to load booking page for lesson ${lessonId}. URL: ${page.url()}`)
}

async function openManagePageWithExpectedState(args: {
  page: Parameters<typeof test>[0]['page']
  tenantSlug: string
  userEmail: string
  lessonId: number
  expectedState: 'quantity' | 'checkout'
}) {
  const { page, tenantSlug, userEmail, lessonId, expectedState } = args
  const quantityHeading = page.getByText(/update booking quantity/i).first()
  const completePaymentHeading = page.getByRole('heading', { name: /complete payment/i })
  const pendingBookingText = page.getByText(/pending booking/i).first()
  const errorHeading = page.getByRole('heading', { name: /booking page error/i })

  for (let attempt = 0; attempt < 3; attempt++) {
    await navigateToTenant(page, tenantSlug, `/bookings/${lessonId}/manage`)
    if (page.url().includes('/auth/sign-in')) {
      await loginAsRegularUser(page, 1, userEmail, 'password', { tenantSlug })
      await page.waitForTimeout(process.env.CI ? 3000 : 1500)
      continue
    }

    await page.waitForLoadState('load').catch(() => null)
    const outcome = await Promise.race([
      quantityHeading.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'quantity' as const),
      completePaymentHeading.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'checkout' as const),
      pendingBookingText.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'checkout' as const),
      errorHeading.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'error' as const),
    ]).catch(() => null)

    if (outcome === expectedState) return
    if (outcome === 'error' && attempt < 2) {
      await loginAsRegularUser(page, 1, userEmail, 'password', { tenantSlug })
      await page.waitForTimeout(process.env.CI ? 3000 : 1500)
      continue
    }
    if (outcome && outcome !== 'error' && attempt < 2) {
      await page.waitForTimeout(process.env.CI ? 1500 : 750)
      continue
    }
  }

  throw new Error(
    `Failed to reach manage page "${expectedState}" state for lesson ${lessonId}. URL: ${page.url()}`
  )
}

async function expectCurrentManageCheckoutState(page: Parameters<typeof test>[0]['page']) {
  const completePaymentHeading = page.getByRole('heading', { name: /complete payment/i })
  const pendingBookingText = page.getByText(/pending booking/i).first()

  const outcome = await Promise.race([
    completePaymentHeading.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'heading' as const),
    pendingBookingText.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'pending' as const),
  ]).catch(() => null)

  if (outcome == null) {
    throw new Error('Expected checkout state on current manage page, but checkout UI never appeared.')
  }
}

async function createClassPassType(args: {
  payload: Awaited<ReturnType<typeof getPayloadInstance>>
  tenantId: number
  workerIndex: number
  name: string
  allowMultipleBookingsPerTimeslot: boolean
}) {
  const { payload, tenantId, workerIndex, name, allowMultipleBookingsPerTimeslot } = args

  return (await payload.create({
    collection: 'class-pass-types',
    data: {
      name: `${name} ${tenantId}-w${workerIndex}-${Date.now()}`,
      slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${tenantId}-${workerIndex}-${Date.now()}`,
      quantity: 10,
      tenant: tenantId,
      allowMultipleBookingsPerTimeslot,
      priceInformation: { price: 39.99 },
      skipSync: true,
      stripeProductId: `prod_test_${tenantId}_${workerIndex}_${Date.now()}`,
    },
    overrideAccess: true,
  })) as { id: number }
}

async function createUserClassPass(args: {
  payload: Awaited<ReturnType<typeof getPayloadInstance>>
  tenantId: number
  userId: number
  typeId: number
  quantity: number
}) {
  const { payload, tenantId, userId, typeId, quantity } = args
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  return payload.create({
    collection: 'class-passes',
    data: {
      user: userId,
      tenant: tenantId,
      type: typeId,
      quantity,
      expirationDate: future.toISOString().slice(0, 10),
      purchasedAt: new Date().toISOString(),
      price: 3999,
      status: 'active',
    },
    overrideAccess: true,
  })
}

test.describe('Manage booking upgrade guards', () => {
  test.describe.configure({ timeout: 120_000 })

  test('disallowed payment-method variants stay capped at one slot on create and manage', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenant = testData.tenants[0]!
    const user = testData.users.user1
    const workerIndex = testData.workerIndex

    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: null,
      },
      overrideAccess: true,
    })

    await loginAsRegularUser(page, 1, user.email, 'password', {
      tenantSlug: tenant.slug,
    })
    await page.waitForTimeout(process.env.CI ? 3000 : 1500)

    const variants = [
      {
        name: 'drop-in only',
        slug: 'dropin-disallowed',
        async configure(classOptionId: number) {
          const dropIn = (await payload.create({
            collection: 'drop-ins',
            data: {
              name: `Single Slot Drop-in ${tenant.id}-w${workerIndex}-${Date.now()}`,
              isActive: true,
              price: 20,
              adjustable: false,
              paymentMethods: ['card'],
              tenant: tenant.id,
            },
            overrideAccess: true,
          })) as { id: number }

          await payload.update({
            collection: 'event-types',
            id: classOptionId,
            data: { paymentMethods: { allowedDropIn: dropIn.id } },
            overrideAccess: true,
          })
        },
      },
      {
        name: 'membership only',
        slug: 'membership-disallowed',
        async configure(classOptionId: number) {
          const plan = await createTestPlan({
            tenantId: tenant.id,
            name: `Single Slot Membership ${tenant.id}-w${workerIndex}-${Date.now()}`,
            sessions: 10,
            allowMultipleBookingsPerTimeslot: false,
          })

          await payload.update({
            collection: 'event-types',
            id: classOptionId,
            data: { paymentMethods: { allowedPlans: [plan.id] } },
            overrideAccess: true,
          })
        },
      },
      {
        name: 'class pass only',
        slug: 'classpass-disallowed',
        async configure(classOptionId: number) {
          const classPassType = await createClassPassType({
            payload,
            tenantId: tenant.id,
            workerIndex,
            name: 'Single Slot Class Pass',
            allowMultipleBookingsPerTimeslot: false,
          })

          await createUserClassPass({
            payload,
            tenantId: tenant.id,
            userId: user.id,
            typeId: classPassType.id,
            quantity: 5,
          })

          await payload.update({
            collection: 'event-types',
            id: classOptionId,
            data: { paymentMethods: { allowedClassPasses: [classPassType.id] } },
            overrideAccess: true,
          })
        },
      },
      {
        name: 'all payment methods disallowed',
        slug: 'all-disallowed',
        async configure(classOptionId: number) {
          const dropIn = (await payload.create({
            collection: 'drop-ins',
            data: {
              name: `Single Slot All-Methods Drop-in ${tenant.id}-w${workerIndex}-${Date.now()}`,
              isActive: true,
              price: 22,
              adjustable: false,
              paymentMethods: ['card'],
              tenant: tenant.id,
            },
            overrideAccess: true,
          })) as { id: number }

          const plan = await createTestPlan({
            tenantId: tenant.id,
            name: `Single Slot All-Methods Plan ${tenant.id}-w${workerIndex}-${Date.now()}`,
            sessions: 10,
            allowMultipleBookingsPerTimeslot: false,
          })

          const classPassType = await createClassPassType({
            payload,
            tenantId: tenant.id,
            workerIndex,
            name: 'Single Slot All-Methods Class Pass',
            allowMultipleBookingsPerTimeslot: false,
          })

          await createUserClassPass({
            payload,
            tenantId: tenant.id,
            userId: user.id,
            typeId: classPassType.id,
            quantity: 5,
          })

          await payload.update({
            collection: 'event-types',
            id: classOptionId,
            data: {
              paymentMethods: {
                allowedDropIn: dropIn.id,
                allowedPlans: [plan.id],
                allowedClassPasses: [classPassType.id],
              },
            },
            overrideAccess: true,
          })
        },
      },
    ] as const

    for (let index = 0; index < variants.length; index++) {
      const variant = variants[index]

      await test.step(`caps quantity for ${variant.name}`, async () => {
        const classOption = await createTestEventType(
          tenant.id,
          `Single Slot Upgrade Guard ${variant.slug}`,
          6,
          undefined,
          workerIndex
        )

        await variant.configure(classOption.id)

        const startTime = new Date()
        startTime.setHours(9 + index, 0, 0, 0)
        startTime.setDate(startTime.getDate() + 1 + workerIndex)
        const endTime = new Date(startTime)
        endTime.setHours(startTime.getHours() + 1, 0, 0, 0)

        const lesson = await createTestTimeslot(
          tenant.id,
          classOption.id,
          startTime,
          endTime,
          undefined,
          true
        )

        await openBookingPage({
          page,
          tenantSlug: tenant.slug,
          userEmail: user.email,
          lessonId: lesson.id,
        })

        await expect(page.getByText(/only 1 slot per booking/i)).toBeVisible({ timeout: 10000 })
        await expect(page.getByRole('button', { name: /increase quantity/i })).toHaveCount(0)

        await createTestBooking(user.id, lesson.id, 'confirmed')

        await openManagePageWithExpectedState({
          page,
          tenantSlug: tenant.slug,
          userEmail: user.email,
          lessonId: lesson.id,
          expectedState: 'quantity',
        })

        const quantityDisplay = page.getByTestId('booking-quantity')
        const increaseButton = page.getByRole('button', { name: /increase quantity/i })

        await expect(quantityDisplay).toHaveText('1', { timeout: 10000 })
        await expect(increaseButton).toBeDisabled()
      })
    }
  })

  test('allowed payment-method variants require payment when increasing quantity', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenant = testData.tenants[0]!
    const user = testData.users.user2
    const workerIndex = testData.workerIndex

    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: null,
      },
      overrideAccess: true,
    })

    await loginAsRegularUser(page, 1, user.email, 'password', {
      tenantSlug: tenant.slug,
    })
    await page.waitForTimeout(process.env.CI ? 3000 : 1500)

    const variants = [
      {
        name: 'drop-in only',
        slug: 'drop-in-only',
        async configurePaymentMethods(classOptionId: number) {
          const dropIn = (await payload.create({
            collection: 'drop-ins',
            data: {
              name: `Manage Upgrade Drop-in ${tenant.id}-w${workerIndex}-${Date.now()}`,
              isActive: true,
              price: 24,
              adjustable: true,
              paymentMethods: ['card'],
              tenant: tenant.id,
            },
            overrideAccess: true,
          })) as { id: number }

          await payload.update({
            collection: 'event-types',
            id: classOptionId,
            data: {
              paymentMethods: {
                allowedDropIn: dropIn.id,
              },
            },
            overrideAccess: true,
          })
        },
        expectedTabs: [/drop-?in/i],
      },
      {
        name: 'membership only',
        slug: 'membership-only',
        async configurePaymentMethods(classOptionId: number) {
          const plan = await createTestPlan({
            tenantId: tenant.id,
            name: `Manage Upgrade Membership ${tenant.id}-w${workerIndex}-${Date.now()}`,
            sessions: 10,
            allowMultipleBookingsPerTimeslot: true,
          })

          await payload.update({
            collection: 'event-types',
            id: classOptionId,
            data: {
              paymentMethods: {
                allowedPlans: [plan.id],
              },
            },
            overrideAccess: true,
          })
        },
        expectedTabs: [/membership/i],
      },
      {
        name: 'drop-in and membership',
        slug: 'drop-in-and-membership',
        async configurePaymentMethods(classOptionId: number) {
          const dropIn = (await payload.create({
            collection: 'drop-ins',
            data: {
              name: `Manage Upgrade Mixed Drop-in ${tenant.id}-w${workerIndex}-${Date.now()}`,
              isActive: true,
              price: 26,
              adjustable: true,
              paymentMethods: ['card'],
              tenant: tenant.id,
            },
            overrideAccess: true,
          })) as { id: number }

          const plan = await createTestPlan({
            tenantId: tenant.id,
            name: `Manage Upgrade Mixed Membership ${tenant.id}-w${workerIndex}-${Date.now()}`,
            sessions: 12,
            allowMultipleBookingsPerTimeslot: true,
          })

          await payload.update({
            collection: 'event-types',
            id: classOptionId,
            data: {
              paymentMethods: {
                allowedDropIn: dropIn.id,
                allowedPlans: [plan.id],
              },
            },
            overrideAccess: true,
          })
        },
        expectedTabs: [/drop-?in/i, /membership/i],
      },
      {
        name: 'all payment methods',
        slug: 'all-payment-methods',
        async configurePaymentMethods(classOptionId: number) {
          const dropIn = (await payload.create({
            collection: 'drop-ins',
            data: {
              name: `Manage Upgrade All-Methods Drop-in ${tenant.id}-w${workerIndex}-${Date.now()}`,
              isActive: true,
              price: 28,
              adjustable: true,
              paymentMethods: ['card'],
              tenant: tenant.id,
            },
            overrideAccess: true,
          })) as { id: number }

          const plan = await createTestPlan({
            tenantId: tenant.id,
            name: `Manage Upgrade All-Methods Membership ${tenant.id}-w${workerIndex}-${Date.now()}`,
            sessions: 12,
            allowMultipleBookingsPerTimeslot: true,
          })

          const classPassType = await createClassPassType({
            payload,
            tenantId: tenant.id,
            workerIndex,
            name: 'Manage Upgrade All-Methods Class Pass',
            allowMultipleBookingsPerTimeslot: true,
          })

          await createUserClassPass({
            payload,
            tenantId: tenant.id,
            userId: user.id,
            typeId: classPassType.id,
            quantity: 5,
          })

          await payload.update({
            collection: 'event-types',
            id: classOptionId,
            data: {
              paymentMethods: {
                allowedDropIn: dropIn.id,
                allowedPlans: [plan.id],
                allowedClassPasses: [classPassType.id],
              },
            },
            overrideAccess: true,
          })
        },
        expectedTabs: [/drop-?in/i, /membership/i, /class pass/i],
      },
    ] as const

    for (let index = 0; index < variants.length; index++) {
      const variant = variants[index]

      await test.step(`forces checkout for ${variant.name}`, async () => {
        const classOption = await createTestEventType(
          tenant.id,
          `Manage Upgrade ${variant.slug}`,
          8,
          undefined,
          workerIndex
        )

        await variant.configurePaymentMethods(classOption.id)

        const startTime = new Date()
        startTime.setHours(11 + index, 0, 0, 0)
        startTime.setDate(startTime.getDate() + 2 + workerIndex)
        const endTime = new Date(startTime)
        endTime.setHours(startTime.getHours() + 1, 0, 0, 0)

        const lesson = await createTestTimeslot(
          tenant.id,
          classOption.id,
          startTime,
          endTime,
          undefined,
          true
        )

        await createTestBooking(user.id, lesson.id, 'confirmed')

        await openManagePageWithExpectedState({
          page,
          tenantSlug: tenant.slug,
          userEmail: user.email,
          lessonId: lesson.id,
          expectedState: 'quantity',
        })

        const quantityDisplay = page.getByTestId('booking-quantity')
        await expect(quantityDisplay).toHaveText('1', { timeout: 10000 })

        const increaseButton = page.getByRole('button', { name: /increase quantity/i })
        await expect(increaseButton).toBeEnabled({ timeout: 10000 })
        await increaseButton.click()
        await expect(quantityDisplay).toHaveText('2', { timeout: 10000 })

        await page.getByRole('button', { name: /update bookings/i }).click()
        await expectCurrentManageCheckoutState(page)

        await expect(page.getByText(/complete payment/i).first()).toBeVisible({
          timeout: 10000,
        })
        await expect(page.getByText(/pending booking/i).first()).toBeVisible({ timeout: 10000 })

        for (const tabName of variant.expectedTabs) {
          await expect(page.getByRole('tab', { name: tabName })).toBeVisible()
        }

        await expect(page.getByText(/please complete payment to confirm your additional bookings/i)).toBeVisible({
          timeout: 10000,
        })
      })
    }
  })

  test('new booking quantity updates immediately when changed during checkout', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenant = testData.tenants[0]!
    const user = testData.users.user3 ?? testData.users.user1
    const workerIndex = testData.workerIndex

    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: null,
      },
      overrideAccess: true,
    })

    await loginAsRegularUser(page, 1, user.email, 'password', {
      tenantSlug: tenant.slug,
    })
    await page.waitForTimeout(process.env.CI ? 3000 : 1500)

    const classOption = await createTestEventType(
      tenant.id,
      'Manage checkout quantity display',
      8,
      undefined,
      workerIndex
    )

    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `Manage checkout quantity drop-in ${tenant.id}-w${workerIndex}-${Date.now()}`,
        isActive: true,
        price: 24,
        adjustable: true,
        paymentMethods: ['card'],
        tenant: tenant.id,
      },
      overrideAccess: true,
    })) as { id: number }

    await payload.update({
      collection: 'event-types',
      id: classOption.id,
      data: {
        paymentMethods: {
          allowedDropIn: dropIn.id,
        },
      },
      overrideAccess: true,
    })

    const startTime = new Date()
    startTime.setHours(16, 0, 0, 0)
    startTime.setDate(startTime.getDate() + 2 + workerIndex)
    const endTime = new Date(startTime)
    endTime.setHours(startTime.getHours() + 1, 0, 0, 0)

    const lesson = await createTestTimeslot(
      tenant.id,
      classOption.id,
      startTime,
      endTime,
      undefined,
      true
    )

    await createTestBooking(user.id, lesson.id, 'confirmed')

    await openManagePageWithExpectedState({
      page,
      tenantSlug: tenant.slug,
      userEmail: user.email,
      lessonId: lesson.id,
      expectedState: 'quantity',
    })

    const bookingQuantity = page.getByTestId('booking-quantity')
    await expect(bookingQuantity).toHaveText('1', { timeout: 10000 })

    await page.getByRole('button', { name: /increase quantity/i }).click()
    await expect(bookingQuantity).toHaveText('2', { timeout: 10000 })

    await page.getByRole('button', { name: /update bookings/i }).click()
    await expectCurrentManageCheckoutState(page)

    const pendingQuantity = page.getByTestId('pending-booking-quantity')
    const totalBookingsCopy = page.getByText(/this will bring your total number of bookings up to 2\./i)
    const increaseNewBookingsButton = page.getByRole('button', { name: /increase new bookings/i })
    const decreaseNewBookingsButton = page.getByRole('button', { name: /decrease new bookings/i })

    await expect(pendingQuantity).toHaveText('1', { timeout: 10000 })
    await expect(totalBookingsCopy).toBeVisible({ timeout: 10000 })

    await increaseNewBookingsButton.click()
    await expect(pendingQuantity).toHaveText('2', { timeout: 10000 })
    await expect(
      page.getByText(/this will bring your total number of bookings up to 3\./i)
    ).toBeVisible({ timeout: 10000 })

    await page.waitForTimeout(process.env.CI ? 1500 : 750)
    await expect(pendingQuantity).toHaveText('2')

    await decreaseNewBookingsButton.click()
    await expect(pendingQuantity).toHaveText('1', { timeout: 10000 })
    await expect(
      page.getByText(/this will bring your total number of bookings up to 2\./i)
    ).toBeVisible({ timeout: 10000 })
  })
})
