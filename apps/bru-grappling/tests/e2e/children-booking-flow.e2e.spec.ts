import { test, expect } from '@playwright/test'
import {
  clearTestMagicLinks,
  ensureAdminLoggedIn,
  mockPaymentIntentSucceededWebhook,
  mockSubscriptionCreatedWebhook,
  waitForServerReady,
} from './helpers'
import {
  ensureLessonForTomorrowChild,
  registerParentAndGetMagicLink,
} from './children-helpers'
import {
  ensureHomePageWithSchedule,
  goToTomorrowInSchedule,
} from '@repo/testing-config/src/playwright'

test.describe('Children booking flow – redirect and access', () => {
  test.setTimeout(180000)

  test('1.1 Check In on child lesson redirects to complete-booking', async ({ page }) => {
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    await ensureLessonForTomorrowChild(page, { payment: 'none' })

    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
    await expect(page.locator('#schedule')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Schedule/i })).toBeVisible()

    await goToTomorrowInSchedule(page)

    const checkInBtn = page.getByRole('button', { name: /Check In/i }).first()
    await expect(checkInBtn).toBeVisible({ timeout: 60000 })
    await expect(checkInBtn).toBeEnabled({ timeout: 10000 }).catch(() => page.waitForTimeout(1000))

    const completeNav = page.waitForURL(/\/complete-booking/, {
      timeout: process.env.CI ? 60000 : 30000,
      waitUntil: 'load',
    })
    await checkInBtn.click()
    await completeNav

    await expect(page).toHaveURL(/\/complete-booking/)
    const u = new URL(page.url())
    const callback = u.searchParams.get('callbackUrl')
    expect(callback).toMatch(/^\/bookings\/\d+/)
  })

  test('1.2 After login, callback leads to children page', async ({ page }) => {
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    const { lessonId } = await ensureLessonForTomorrowChild(page, { payment: 'none' })

    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
    await expect(page.locator('#schedule')).toBeVisible()
    await goToTomorrowInSchedule(page)

    const checkInBtn = page.getByRole('button', { name: /Check In/i }).first()
    await expect(checkInBtn).toBeVisible({ timeout: 60000 })
    await expect(checkInBtn).toBeEnabled({ timeout: 10000 }).catch(() => page.waitForTimeout(1000))

    const completeNav = page.waitForURL(/\/complete-booking/, {
      timeout: process.env.CI ? 60000 : 30000,
      waitUntil: 'load',
    })
    await checkInBtn.click()
    await completeNav

    await registerParentAndGetMagicLink(page, { callbackPath: `/bookings/${lessonId}` })

    await expect(page).toHaveURL(/\/bookings\/children\/\d+/)
    await expect(
      page.locator('text=/Manage Current Bookings|Children|Select children/i').first(),
    ).toBeVisible({ timeout: 15000 })
  })

  test('1.3 Direct /bookings/[id] for child lesson redirects to children', async ({ page }) => {
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    const { lessonId } = await ensureLessonForTomorrowChild(page, { payment: 'none' })

    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    await page.goto(`/complete-booking?mode=register&callbackUrl=/bookings/${lessonId}`, {
      waitUntil: 'load',
      timeout: 60000,
    })
    await registerParentAndGetMagicLink(page, { callbackPath: `/bookings/${lessonId}` })

    await expect(page).toHaveURL(new RegExp(`/bookings/children/${lessonId}`))
  })

  test('1.4 Unauthenticated /bookings/children/[id] redirects to complete-booking', async ({ page }) => {
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    const { lessonId } = await ensureLessonForTomorrowChild(page, { payment: 'none' })

    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    await page.goto(`/bookings/children/${lessonId}`, { waitUntil: 'load', timeout: 60000 })

    await expect(page).toHaveURL(/\/complete-booking/)
    const u = new URL(page.url())
    expect(u.searchParams.get('callbackUrl')).toBe(`/bookings/${lessonId}`)
  })

  test('1.5 Invalid child page shows error', async ({ page }) => {
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    const { lessonId } = await ensureLessonForTomorrowChild(page, { payment: 'none' })

    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    await page.goto(`/complete-booking?mode=register&callbackUrl=/bookings/${lessonId}`, {
      waitUntil: 'load',
      timeout: 60000,
    })
    await registerParentAndGetMagicLink(page, { callbackPath: `/bookings/${lessonId}` })

    await expect(page).toHaveURL(/\/bookings\/children\/\d+/)

    await page.goto('/bookings/children/999999', { waitUntil: 'load', timeout: 60000 })
    await expect(page.getByText(/Something went wrong/i)).toBeVisible({ timeout: 15000 })
  })
})

test.describe('Children booking flow – no payment methods (ChildrensBookingForm)', () => {
  test.setTimeout(180000)

  test('2.1 Child lesson, no payment methods: form only', async ({ page }) => {
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    const { lessonId } = await ensureLessonForTomorrowChild(page, { payment: 'none' })

    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    await page.goto(`/complete-booking?mode=register&callbackUrl=/bookings/${lessonId}`, {
      waitUntil: 'load',
      timeout: 60000,
    })
    await registerParentAndGetMagicLink(page, { callbackPath: `/bookings/${lessonId}` })

    await expect(page).toHaveURL(/\/bookings\/children\/\d+/)
    await expect(page.getByText(/Children/i).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Select children|Register your first child/i).first()).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByRole('tab', { name: /Drop-?in|Subscription|Membership/i })).toHaveCount(0)
  })

  test('2.2 Add child, then book', async ({ page }) => {
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    const { lessonId } = await ensureLessonForTomorrowChild(page, { payment: 'none' })

    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    await page.goto(`/complete-booking?mode=register&callbackUrl=/bookings/${lessonId}`, {
      waitUntil: 'load',
      timeout: 60000,
    })
    await registerParentAndGetMagicLink(page, {
      callbackPath: `/bookings/${lessonId}`,
    })

    await expect(page).toHaveURL(/\/bookings\/children\/\d+/)

    await expect(page.getByText(/Register your first child|Select children/i)).toBeVisible({
      timeout: 10000,
    })
    const addChildBtn = page.getByRole('button', { name: /Add new child/i })
    if ((await addChildBtn.count()) > 0) {
      await addChildBtn.click()
      await page.getByRole('textbox', { name: /Name/i }).fill('Child One')
      await page.getByRole('textbox', { name: /Email|Child.*email/i }).fill(`child-${Date.now()}@example.com`)
      await page.getByRole('button', { name: /Add child/i }).click()
      await expect(page.getByText(/Child One|Select children/i).first()).toBeVisible({ timeout: 10000 })
    }

    const selectTrigger = page.getByRole('button', { name: /Select children/i })
    if ((await selectTrigger.count()) > 0) {
      await selectTrigger.click()
      await page.getByRole('option').first().click()
    }

    await expect(page.getByRole('link', { name: /Complete booking/i })).toBeVisible({
      timeout: 10000,
    })
    await page.getByRole('link', { name: /Complete booking/i }).click()
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('2.3 Manage current bookings: unbook', async ({ page }) => {
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    const { lessonId } = await ensureLessonForTomorrowChild(page, { payment: 'none' })

    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    await page.goto(`/complete-booking?mode=register&callbackUrl=/bookings/${lessonId}`, {
      waitUntil: 'load',
      timeout: 60000,
    })
    await registerParentAndGetMagicLink(page, { callbackPath: `/bookings/${lessonId}` })

    await expect(page).toHaveURL(/\/bookings\/children\/\d+/)

    const addChildBtn = page.getByRole('button', { name: /Add new child/i })
    if ((await addChildBtn.count()) > 0) {
      await addChildBtn.click()
      await page.getByRole('textbox', { name: /Name/i }).fill('Child To Unbook')
      await page.getByRole('textbox', { name: /Email|Child.*email/i }).fill(`unbook-${Date.now()}@example.com`)
      await page.getByRole('button', { name: /Add child/i }).click()
      await page.waitForTimeout(2000)
    }

    const selectTrigger = page.getByRole('button', { name: /Select children/i })
    if ((await selectTrigger.count()) > 0) {
      await selectTrigger.click()
      await page.getByRole('option').first().click()
      await page.waitForTimeout(1000)
    }

    await expect(page.getByText(/Manage Current Bookings/i)).toBeVisible({ timeout: 10000 })
    const row = page.locator('div:has-text("Child To Unbook")').first()
    await expect(row).toBeVisible({ timeout: 5000 })
    const unbookBtn = row.locator('..').getByRole('button').first()
    await unbookBtn.click()
    await page.waitForTimeout(2000)
    await expect(page.getByText(/Manage Current Bookings/i)).toHaveCount(0)
  })

  test('2.4 canBookChild false: cannot add more', async ({ page }) => {
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    const { lessonId } = await ensureLessonForTomorrowChild(page, { payment: 'none', places: 1 })

    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    await page.goto(`/complete-booking?mode=register&callbackUrl=/bookings/${lessonId}`, {
      waitUntil: 'load',
      timeout: 60000,
    })
    await registerParentAndGetMagicLink(page, { callbackPath: `/bookings/${lessonId}` })

    await expect(page).toHaveURL(/\/bookings\/children\/\d+/)

    const addChildBtn = page.getByRole('button', { name: /Add new child/i })
    if ((await addChildBtn.count()) > 0) {
      await addChildBtn.click()
      await page.getByRole('textbox', { name: /Name/i }).fill('Only Child')
      await page.getByRole('textbox', { name: /Email|Child.*email/i }).fill(`only-${Date.now()}@example.com`)
      await page.getByRole('button', { name: /Add child/i }).click()
      await page.waitForTimeout(2000)
    }

    const selectTrigger = page.getByRole('button', { name: /Select children/i })
    if ((await selectTrigger.count()) > 0) {
      await selectTrigger.click()
      await page.getByRole('option').first().click()
      await page.waitForTimeout(1000)
    }

    await expect(page.getByText(/You cannot book more children for this lesson/i)).toBeVisible({
      timeout: 10000,
    })
  })

  test('2.5 Lesson full', async ({ page }) => {
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    const { lessonId } = await ensureLessonForTomorrowChild(page, { payment: 'none', places: 1 })

    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    await page.goto(`/complete-booking?mode=register&callbackUrl=/bookings/${lessonId}`, {
      waitUntil: 'load',
      timeout: 60000,
    })
    await registerParentAndGetMagicLink(page, { callbackPath: `/bookings/${lessonId}` })

    const addChildBtn = page.getByRole('button', { name: /Add new child/i })
    if ((await addChildBtn.count()) > 0) {
      await addChildBtn.click()
      await page.getByRole('textbox', { name: /Name/i }).fill('Child One')
      await page.getByRole('textbox', { name: /Email|Child.*email/i }).fill(`full-${Date.now()}@example.com`)
      await page.getByRole('button', { name: /Add child/i }).click()
      await page.waitForTimeout(2000)
    }

    const selectTrigger = page.getByRole('button', { name: /Select children/i })
    if ((await selectTrigger.count()) > 0) {
      await selectTrigger.click()
      await page.getByRole('option').first().click()
      await page.waitForTimeout(1000)
    }

    await page.getByRole('link', { name: /Complete booking/i }).click()
    await expect(page).toHaveURL(/\/dashboard/)
    await page.goto(`/bookings/children/${lessonId}`, { waitUntil: 'load', timeout: 60000 })

    await expect(
      page.getByText(/This lesson is now full|You cannot book more children/i),
    ).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Children booking flow – payment tabs (no subscription)', () => {
  test.setTimeout(180000)

  test('3.1 No subscription: show payment tabs', async ({ page }) => {
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    const { lessonId } = await ensureLessonForTomorrowChild(page, { payment: 'dropIn' })

    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    await page.goto(`/complete-booking?mode=register&callbackUrl=/bookings/${lessonId}`, {
      waitUntil: 'load',
      timeout: 60000,
    })
    await registerParentAndGetMagicLink(page, { callbackPath: `/bookings/${lessonId}` })

    await expect(page).toHaveURL(/\/bookings\/children\/\d+/)
    await expect(page.getByRole('tab', { name: /Drop-?in/i })).toBeVisible({ timeout: 10000 })
  })

  test('3.2 Drop-in tab: select children, pending bookings, payment element', async ({ page }) => {
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    const { lessonId } = await ensureLessonForTomorrowChild(page, { payment: 'dropIn' })

    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    await page.goto(`/complete-booking?mode=register&callbackUrl=/bookings/${lessonId}`, {
      waitUntil: 'load',
      timeout: 60000,
    })
    await registerParentAndGetMagicLink(page, {
      callbackPath: `/bookings/${lessonId}`,
    })

    await expect(page).toHaveURL(/\/bookings\/children\/\d+/)

    const dropInTab = page.getByRole('tab', { name: /Drop-?in/i })
    await dropInTab.click()

    const addChildBtn = page.getByRole('button', { name: /Add new child/i })
    if ((await addChildBtn.count()) > 0) {
      await addChildBtn.click()
      await page.getByRole('textbox', { name: /Name/i }).fill('Drop-in Child')
      await page.getByRole('textbox', { name: /Email|Child.*email/i }).fill(`dropin-${Date.now()}@example.com`)
      await page.getByRole('button', { name: /Add child/i }).click()
      await page.waitForTimeout(2000)
    }

    const selectTrigger = page.getByRole('button', { name: /Select children/i })
    if ((await selectTrigger.count()) > 0) {
      await selectTrigger.click()
      await page.getByRole('option').first().click()
      await page.waitForTimeout(1000)
    }

    await expect(page.getByText(/Requires Payment/i)).toBeVisible({ timeout: 10000 })
    await expect(page.locator('#payment-element')).toBeAttached({ timeout: 20000 })
  })

  test('3.3 Drop-in: pay via webhook, booking confirmed on dashboard', async ({ page }) => {
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    const { lessonId } = await ensureLessonForTomorrowChild(page, { payment: 'dropIn' })

    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    await page.goto(`/complete-booking?mode=register&callbackUrl=/bookings/${lessonId}`, {
      waitUntil: 'load',
      timeout: 60000,
    })
    const { email } = await registerParentAndGetMagicLink(page, {
      callbackPath: `/bookings/${lessonId}`,
    })

    const dropInTab = page.getByRole('tab', { name: /Drop-?in/i })
    await dropInTab.click()

    const addChildBtn = page.getByRole('button', { name: /Add new child/i })
    if ((await addChildBtn.count()) > 0) {
      await addChildBtn.click()
      await page.getByRole('textbox', { name: /Name/i }).fill('Pay Child')
      await page.getByRole('textbox', { name: /Email|Child.*email/i }).fill(`pay-${Date.now()}@example.com`)
      await page.getByRole('button', { name: /Add child/i }).click()
      await page.waitForTimeout(2000)
    }

    const selectTrigger = page.getByRole('button', { name: /Select children/i })
    if ((await selectTrigger.count()) > 0) {
      await selectTrigger.click()
      await page.getByRole('option').first().click()
      await page.waitForTimeout(2000)
    }

    await expect(page.locator('#payment-element')).toBeAttached({ timeout: 20000 })

    await mockPaymentIntentSucceededWebhook(page.context().request, { lessonId, userEmail: email })

    await page.goto('/dashboard', { waitUntil: 'load', timeout: 60000 })
    await expect(page).toHaveURL(/\/dashboard/)
    await goToTomorrowInSchedule(page)
    await expect(page.getByRole('button', { name: /Cancel Booking/i }).first()).toBeVisible({
      timeout: 20000,
    })
  })

  test('3.4 Subscription tab: subscribe, webhook confirms booking', async ({ page }) => {
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    const { lessonId } = await ensureLessonForTomorrowChild(page, { payment: 'subscription' })

    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    await page.goto(`/complete-booking?mode=register&callbackUrl=/bookings/${lessonId}`, {
      waitUntil: 'load',
      timeout: 60000,
    })
    const { email } = await registerParentAndGetMagicLink(page, {
      callbackPath: `/bookings/${lessonId}`,
    })

    const subTab = page.getByRole('tab', { name: /Subscription|Membership/i })
    await subTab.click()

    const addChildBtn = page.getByRole('button', { name: /Add new child/i })
    if ((await addChildBtn.count()) > 0) {
      await addChildBtn.click()
      await page.getByRole('textbox', { name: /Name/i }).fill('Sub Child')
      await page.getByRole('textbox', { name: /Email|Child.*email/i }).fill(`sub-${Date.now()}@example.com`)
      await page.getByRole('button', { name: /Add child/i }).click()
      await page.waitForTimeout(2000)
    }

    const selectTrigger = page.getByRole('button', { name: /Select children/i })
    if ((await selectTrigger.count()) > 0) {
      await selectTrigger.click()
      await page.getByRole('option').first().click()
      await page.waitForTimeout(2000)
    }

    const subscribeBtn = page.getByRole('button', { name: /Subscribe/i }).first()
    await expect(subscribeBtn).toBeVisible({ timeout: 10000 })

    const checkoutPromise = page.waitForResponse(
      (r) =>
        r.url().includes('/api/trpc/payments.createCustomerCheckoutSession') &&
        r.request().method() === 'POST',
      { timeout: 15000 },
    )
    await Promise.all([checkoutPromise, subscribeBtn.click()])
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 })

    await mockSubscriptionCreatedWebhook(page.context().request, { lessonId, userEmail: email })

    await page.goto('/dashboard', { waitUntil: 'load', timeout: 60000 })
    await goToTomorrowInSchedule(page)
    await expect(page.getByRole('button', { name: /Cancel Booking/i }).first()).toBeVisible({
      timeout: 20000,
    })
  })
})

test.describe('Children booking flow – valid subscription', () => {
  test.setTimeout(180000)

  test('4.1 Valid subscription, limit not reached: form', async ({ page }) => {
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    const { lessonId } = await ensureLessonForTomorrowChild(page, { payment: 'subscription' })

    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    await page.goto(`/complete-booking?mode=register&callbackUrl=/bookings/${lessonId}`, {
      waitUntil: 'load',
      timeout: 60000,
    })
    const { email } = await registerParentAndGetMagicLink(page, { callbackPath: `/bookings/${lessonId}` })

    const subTab = page.getByRole('tab', { name: /Subscription|Membership/i })
    await subTab.click()

    const addChildBtn = page.getByRole('button', { name: /Add new child/i })
    if ((await addChildBtn.count()) > 0) {
      await addChildBtn.click()
      await page.getByRole('textbox', { name: /Name/i }).fill('Form Child')
      await page.getByRole('textbox', { name: /Email|Child.*email/i }).fill(`form-${Date.now()}@example.com`)
      await page.getByRole('button', { name: /Add child/i }).click()
      await page.waitForTimeout(2000)
    }

    const selectTrigger = page.getByRole('button', { name: /Select children/i })
    if ((await selectTrigger.count()) > 0) {
      await selectTrigger.click()
      await page.getByRole('option').first().click()
      await page.waitForTimeout(1000)
    }

    const subscribeBtn = page.getByRole('button', { name: /Subscribe/i }).first()
    await subscribeBtn.click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 })

    await mockSubscriptionCreatedWebhook(page.context().request, { lessonId, userEmail: email })

    await page.goto(`/bookings/children/${lessonId}`, { waitUntil: 'load', timeout: 60000 })
    await expect(page.getByText(/Children|Select children/i).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Subscription Issue/i)).not.toBeVisible()
    await expect(page.getByRole('tab', { name: /Drop-?in|Subscription|Membership/i })).toHaveCount(0)
  })

  test('4.2 Book with valid subscription', async ({ page }) => {
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    const { lessonId } = await ensureLessonForTomorrowChild(page, { payment: 'subscription' })

    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    await page.goto(`/complete-booking?mode=register&callbackUrl=/bookings/${lessonId}`, {
      waitUntil: 'load',
      timeout: 60000,
    })
    const { email } = await registerParentAndGetMagicLink(page, { callbackPath: `/bookings/${lessonId}` })

    const subTab = page.getByRole('tab', { name: /Subscription|Membership/i })
    await subTab.click()

    const addChildBtn = page.getByRole('button', { name: /Add new child/i })
    if ((await addChildBtn.count()) > 0) {
      await addChildBtn.click()
      await page.getByRole('textbox', { name: /Name/i }).fill('Book Child')
      await page.getByRole('textbox', { name: /Email|Child.*email/i }).fill(`book-${Date.now()}@example.com`)
      await page.getByRole('button', { name: /Add child/i }).click()
      await page.waitForTimeout(2000)
    }

    const selectTrigger = page.getByRole('button', { name: /Select children/i })
    if ((await selectTrigger.count()) > 0) {
      await selectTrigger.click()
      await page.getByRole('option').first().click()
      await page.waitForTimeout(1000)
    }

    const subscribeBtn = page.getByRole('button', { name: /Subscribe/i }).first()
    await subscribeBtn.click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 })

    await mockSubscriptionCreatedWebhook(page.context().request, { lessonId, userEmail: email })

    await page.goto(`/bookings/children/${lessonId}`, { waitUntil: 'load', timeout: 60000 })

    const addChildBtn2 = page.getByRole('button', { name: /Add new child/i })
    if ((await addChildBtn2.count()) > 0) {
      await addChildBtn2.click()
      await page.getByRole('textbox', { name: /Name/i }).fill('Confirmed Child')
      await page.getByRole('textbox', { name: /Email|Child.*email/i }).fill(`confirmed-${Date.now()}@example.com`)
      await page.getByRole('button', { name: /Add child/i }).click()
      await page.waitForTimeout(2000)
    }

    const selectTrigger2 = page.getByRole('button', { name: /Select children/i })
    if ((await selectTrigger2.count()) > 0) {
      await selectTrigger2.click()
      await page.getByRole('option').first().click()
      await page.waitForTimeout(1000)
    }

    await expect(page.getByText(/Manage Current Bookings/i)).toBeVisible({ timeout: 10000 })
    await page.getByRole('link', { name: /Complete booking/i }).click()
    await expect(page).toHaveURL(/\/dashboard/)
  })
})

test.describe('Children booking flow – schedule integration', () => {
  test.setTimeout(180000)

  test('7.1 Schedule: Cancel Booking for child lesson', async ({ page }) => {
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    const { lessonId } = await ensureLessonForTomorrowChild(page, { payment: 'none' })

    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    await page.goto(`/complete-booking?mode=register&callbackUrl=/bookings/${lessonId}`, {
      waitUntil: 'load',
      timeout: 60000,
    })
    await registerParentAndGetMagicLink(page, { callbackPath: `/bookings/${lessonId}` })

    const addChildBtn = page.getByRole('button', { name: /Add new child/i })
    if ((await addChildBtn.count()) > 0) {
      await addChildBtn.click()
      await page.getByRole('textbox', { name: /Name/i }).fill('Schedule Child')
      await page.getByRole('textbox', { name: /Email|Child.*email/i }).fill(`sched-${Date.now()}@example.com`)
      await page.getByRole('button', { name: /Add child/i }).click()
      await page.waitForTimeout(2000)
    }

    const selectTrigger = page.getByRole('button', { name: /Select children/i })
    if ((await selectTrigger.count()) > 0) {
      await selectTrigger.click()
      await page.getByRole('option').first().click()
      await page.waitForTimeout(1000)
    }

    await page.getByRole('link', { name: /Complete booking/i }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    await page.goto('/dashboard', { waitUntil: 'load', timeout: 60000 })
    await goToTomorrowInSchedule(page)

    const cancelBtn = page.getByRole('button', { name: /Cancel Booking/i }).first()
    await expect(cancelBtn).toBeVisible({ timeout: 20000 })
    await cancelBtn.click()

    const confirmDialog = page.getByRole('dialog').filter({ hasText: /Are you sure you want to cancel/i })
    if (await confirmDialog.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmDialog.getByRole('button', { name: /^Confirm$/i }).click()
    }

    await expect(page.getByRole('button', { name: /Check In/i }).first()).toBeVisible({ timeout: 20000 })
  })

  test('7.2 Schedule: Check In on child lesson when logged in', async ({ page }) => {
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    const { lessonId } = await ensureLessonForTomorrowChild(page, { payment: 'none' })

    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    await page.goto(`/complete-booking?mode=register&callbackUrl=/bookings/${lessonId}`, {
      waitUntil: 'load',
      timeout: 60000,
    })
    await registerParentAndGetMagicLink(page, { callbackPath: `/bookings/${lessonId}` })

    await expect(page).toHaveURL(/\/bookings\/children\/\d+/)
    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
    await goToTomorrowInSchedule(page)

    const checkInBtn = page.getByRole('button', { name: /Check In/i }).first()
    await expect(checkInBtn).toBeVisible({ timeout: 60000 })
    await checkInBtn.click()

    await expect(page).toHaveURL(/\/bookings\/children\/\d+/, { timeout: 15000 })
  })
})

test.describe('Children booking flow – subscription issues, upgrade, access', () => {
  test.setTimeout(180000)

  test('5.1 Limit reached: subscription issue + update', async ({ page }) => {
    test.skip(true, 'Requires subscription with sessions limit + booked sessions setup')
  })

  test('5.2 Inactive status: subscription issue', async ({ page }) => {
    test.skip(true, 'Requires subscription with past_due/canceled status via API')
  })

  test('6.1 Upgrade cards', async ({ page }) => {
    test.skip(true, 'Requires parent with subscription for non-allowed plan + lesson with different plans')
  })

  test('8.1 User with no children sees register-first-child UI', async ({ page }) => {
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    const { lessonId } = await ensureLessonForTomorrowChild(page, { payment: 'none' })

    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    await page.goto(`/complete-booking?mode=register&callbackUrl=/bookings/${lessonId}`, {
      waitUntil: 'load',
      timeout: 60000,
    })
    await registerParentAndGetMagicLink(page, { callbackPath: `/bookings/${lessonId}` })

    await expect(page).toHaveURL(/\/bookings\/children\/\d+/)
    await expect(page.getByText(/Register your first child|Please register your first child/i)).toBeVisible({
      timeout: 10000,
    })
  })

  test('8.2 Child must be user\'s child', async ({ page }) => {
    test.skip(true, 'Requires API to attempt booking another parent\'s child')
  })

  test('8.3 Child lesson not in getByIdForChildren', async ({ page }) => {
    test.skip(true, 'Covered by 1.5 invalid child page')
  })
})
