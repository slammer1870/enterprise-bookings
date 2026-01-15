import { test, expect } from '@playwright/test'
import { ensureAdminLoggedIn, waitForServerReady } from './helpers'

type Created = { id: number }

function unique(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

async function apiPost<T>(
  page: any,
  path: string,
  data: Record<string, any>,
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const res = await page.context().request.post(`${baseUrl}${path}`, {
    data,
    timeout: 120000,
  })
  if (!res.ok()) {
    const txt = await res.text().catch(() => '')
    throw new Error(`POST ${path} failed: ${res.status()} ${txt}`)
  }
  const json: any = await res.json().catch(() => null)
  return (json?.doc ?? json) as T
}

async function createPlan(page: any, opts: { name: string; type: 'adult' | 'child' }): Promise<Created> {
  // Keep this minimal + skipSync to avoid Stripe side effects in test env.
  const now = Date.now()
  return await apiPost(page, '/api/plans', {
    name: opts.name,
    status: 'active',
    type: opts.type,
    skipSync: true,
    stripeProductId: `prod_test_${opts.type}_${now}`,
    priceJSON: JSON.stringify({ id: `price_test_${opts.type}_${now}` }),
  })
}

async function createUser(
  page: any,
  opts: { name: string; email: string; role?: 'user' | 'admin'; parent?: number | null },
): Promise<Created> {
  return await apiPost(page, '/api/users', {
    name: opts.name,
    email: opts.email,
    password: 'Password123!',
    emailVerified: true,
    role: opts.role ?? 'user',
    parent: typeof opts.parent === 'undefined' ? null : opts.parent,
  })
}

async function createSubscription(
  page: any,
  opts: { userId: number; planId: number },
): Promise<Created> {
  const start = new Date()
  const end = new Date()
  end.setDate(end.getDate() + 30)
  return await apiPost(page, '/api/subscriptions', {
    user: opts.userId,
    plan: opts.planId,
    status: 'active',
    skipSync: true,
    stripeSubscriptionId: `sub_test_${Date.now()}`,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  })
}

async function createClassOption(
  page: any,
  opts: {
    name: string
    type: 'adult' | 'child'
    allowedPlans?: number[]
  },
): Promise<Created> {
  return await apiPost(page, '/api/class-options', {
    name: opts.name,
    places: 50,
    description: 'kiosk e2e',
    type: opts.type,
    paymentMethods:
      typeof opts.allowedPlans === 'undefined'
        ? undefined
        : { allowedPlans: opts.allowedPlans },
  })
}

async function createLesson(
  page: any,
  opts: { classOptionId: number },
): Promise<Created> {
  const start = new Date(Date.now() + 10 * 60 * 1000)
  const end = new Date(Date.now() + 70 * 60 * 1000)
  return await apiPost(page, '/api/lessons', {
    date: new Date().toISOString(),
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    lockOutTime: 0,
    classOption: opts.classOptionId,
    active: true,
  })
}

async function checkInViaKiosk(
  page: any,
  opts: { lessonId: number; userName: string; expectSuccess: boolean },
) {
  const card = page.getByTestId(`kiosk-lesson-card-${opts.lessonId}`)
  await expect(card).toBeVisible({ timeout: 60000 })

  // Ensure the collapsible content is open (don't blindly toggle; it may already be open).
  const openTrigger = card.getByTestId('kiosk-open-checkin')
  const combobox = card.getByTestId('kiosk-user-combobox')
  const fullMessage = card.getByText('This class is full')

  // Click to open collapsible if needed, with retry for animation
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await combobox.isVisible().catch(() => false)) break
    await openTrigger.click().catch(() => {})
    // Wait for collapsible animation to complete
    await page.waitForTimeout(500)
  }

  // Check if the class is unexpectedly showing as full
  if (await fullMessage.isVisible().catch(() => false)) {
    throw new Error(
      `Lesson ${opts.lessonId} shows "This class is full" unexpectedly. ` +
        'Check that remainingCapacity is computed correctly.',
    )
  }

  await expect(combobox).toBeVisible({ timeout: 60000 })
  await combobox.click()

  // Filter list to the user, then select.
  const search = page.getByPlaceholder('Search user...').first()
  await search.fill(opts.userName)
  await page.getByRole('option', { name: new RegExp(opts.userName, 'i') }).first().click()

  await card.getByTestId('kiosk-submit-checkin').click()

  if (opts.expectSuccess) {
    // After query invalidation + refetch, booking name should appear in bookings list.
    await expect(card.getByTestId('kiosk-bookings-list').getByText(opts.userName)).toBeVisible({
      timeout: 60000,
    })
  } else {
    // Error dialog should show and booking should not appear.
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Your booking was not created')).toBeVisible({ timeout: 30000 })
    await expect(dialog.getByText(/see the desk/i)).toBeVisible({ timeout: 30000 })
    // Dialog has both an "X" close button and a footer "Close" button; disambiguate for strict mode.
    await dialog.getByRole('button', { name: /^close$/i }).first().click()
    await expect(card.getByTestId('kiosk-bookings-list').getByText(opts.userName)).toHaveCount(0)
  }
}

test.describe('Kiosk check-in access control (kyuzo)', () => {
  test.setTimeout(240000)

  test('enforces subscription rules for adult + child bookings', async ({ page }) => {
    await waitForServerReady(page.context().request)
    await ensureAdminLoggedIn(page)

    // Plans (adult vs child)
    const adultPlan = await createPlan(page, { name: unique('Adult Plan'), type: 'adult' })
    const childPlan = await createPlan(page, { name: unique('Child Plan'), type: 'child' })

    // Users
    const adultWithSub = await createUser(page, {
      name: unique('Adult With Sub'),
      email: `${unique('adult-with-sub')}@example.com`,
    })
    const adultNoSub = await createUser(page, {
      name: unique('Adult No Sub'),
      email: `${unique('adult-no-sub')}@example.com`,
    })

    const parentWithSub = await createUser(page, {
      name: unique('Parent With Sub'),
      email: `${unique('parent-with-sub')}@example.com`,
    })
    const childWithSubParent = await createUser(page, {
      name: unique('Child With Sub Parent'),
      email: `${unique('child-with-sub-parent')}@example.com`,
      parent: parentWithSub.id,
    })

    const parentNoSub = await createUser(page, {
      name: unique('Parent No Sub'),
      email: `${unique('parent-no-sub')}@example.com`,
    })
    const childNoSubParent = await createUser(page, {
      name: unique('Child No Sub Parent'),
      email: `${unique('child-no-sub-parent')}@example.com`,
      parent: parentNoSub.id,
    })

    // Subscriptions
    await createSubscription(page, { userId: adultWithSub.id, planId: adultPlan.id })
    await createSubscription(page, { userId: parentWithSub.id, planId: childPlan.id })

    // Class options + lessons
    const adultRequiresSub = await createClassOption(page, {
      name: unique('Adult Requires Sub'),
      type: 'adult',
      allowedPlans: [adultPlan.id],
    })
    const adultNoSubRequired = await createClassOption(page, {
      name: unique('Adult No Sub Required'),
      type: 'adult',
      allowedPlans: [],
    })
    const childRequiresSub = await createClassOption(page, {
      name: unique('Child Requires Sub'),
      type: 'child',
      allowedPlans: [childPlan.id],
    })

    const adultSubLesson = await createLesson(page, { classOptionId: adultRequiresSub.id })
    const adultFreeLesson = await createLesson(page, { classOptionId: adultNoSubRequired.id })
    const childSubLesson = await createLesson(page, { classOptionId: childRequiresSub.id })

    // Go to kiosk page once
    await page.goto('/kiosk', { waitUntil: 'domcontentloaded', timeout: 120000 })

    // Adult: active subscription
    await test.step('adult with active subscription can check in to subscription-required lesson', async () => {
      await checkInViaKiosk(page, {
        lessonId: adultSubLesson.id,
        userName: (adultWithSub as any).name,
        expectSuccess: true,
      })
    })

    // Adult: no subscription, lesson requires subscription
    await test.step('adult without active subscription cannot check in to subscription-required lesson', async () => {
      await checkInViaKiosk(page, {
        lessonId: adultSubLesson.id,
        userName: (adultNoSub as any).name,
        expectSuccess: false,
      })
    })

    // Adult: no subscription, lesson does not require subscription
    await test.step('adult without subscription can check in to lesson without subscription requirement', async () => {
      await checkInViaKiosk(page, {
        lessonId: adultFreeLesson.id,
        userName: (adultNoSub as any).name,
        expectSuccess: true,
      })
    })

    // Child: parent has active subscription for child plan
    await test.step('child can check in when parent has active subscription for child lesson that requires it', async () => {
      await checkInViaKiosk(page, {
        lessonId: childSubLesson.id,
        userName: (childWithSubParent as any).name,
        expectSuccess: true,
      })
    })

    // Child: parent has no active subscription for child plan
    await test.step('child cannot check in when parent has no active subscription for child lesson that requires it', async () => {
      await checkInViaKiosk(page, {
        lessonId: childSubLesson.id,
        userName: (childNoSubParent as any).name,
        expectSuccess: false,
      })
    })
  })
})


