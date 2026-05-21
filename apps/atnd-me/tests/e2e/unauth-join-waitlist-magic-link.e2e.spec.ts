import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  createTestBooking,
} from './helpers/data-helpers'

import { clearTestMagicLinks, pollForTestMagicLink } from '@repo/testing-config/src/playwright'

/**
 * Requirement:
 * unauth user clicks "Join Waitlist" → prompted to login → receives magic link → clicking it
 * adds them to the waitlist with visual feedback.
 */
test.describe('Unauth join waitlist (magic link)', () => {
  test.setTimeout(180_000)

  test('unauth user is prompted to login and then is added to waitlist', async ({ page, request, testData }) => {
    const tenant = testData.tenants[0]!
    const workerIndex = testData.workerIndex
    const w = workerIndex

    const eventType = await createTestEventType(
      tenant.id,
      'Waitlist Join Leave Magic Link Class',
      1,
      undefined,
      w,
    )
    const eventName = eventType.name

    const startTime = new Date()
    startTime.setDate(startTime.getDate() + 2 + workerIndex)
    startTime.setHours(11, 0, 0, 0)
    const endTime = new Date(startTime)
    endTime.setHours(12, 0, 0, 0)

    const timeslot = await createTestTimeslot(tenant.id, eventType.id, startTime, endTime, undefined, true)
    await createTestBooking(testData.users.user2.id, timeslot.id, 'confirmed')

    // Ensure we start truly unauthenticated.
    await page.context().clearCookies()
    await page.evaluate(() => {
      try {
        localStorage.clear()
        sessionStorage.clear()
      } catch {
        // ignore
      }
    })
    await page.goto('about:blank')

    await navigateToTenant(page, tenant.slug, '/')

    await expect(page.getByRole('heading', { name: /^schedule$/i })).toBeVisible({ timeout: 20_000 })

    const dateLabel = page.locator('p.text-center.text-lg').first()
    await expect(dateLabel).toBeVisible({ timeout: 30_000 })
    const nextDayButton = dateLabel.locator('xpath=..').locator('svg').nth(1)
    const targetLabel = startTime.toDateString()

    for (let i = 0; i < 14; i += 1) {
      const current = (await dateLabel.textContent())?.trim()
      if (current === targetLabel) break
      await nextDayButton.click()
      await expect(dateLabel).toHaveText(targetLabel, { timeout: 10_000 }).catch(() => null)
    }
    await expect(dateLabel).toHaveText(targetLabel, { timeout: 15_000 })

    const timeslotCard = page.locator('div.border-b.border-border').filter({ hasText: eventName }).first()
    await expect(timeslotCard).toBeVisible({ timeout: 20_000 })

    const joinBtn = timeslotCard.getByRole('button', { name: /join.*waitlist/i })
    await expect(joinBtn).toBeVisible()
    await expect(joinBtn).toBeEnabled()

    // Regression guard: unauth shouldn't immediately show a "joined waitlist" success toast.
    await joinBtn.click()
    await expect(page).toHaveURL(/\/complete-booking/,{ timeout: 30_000 })
    await expect(page.getByText(/joined waitlist/i)).toBeHidden({ timeout: 1_500 }).catch(() => null)

    // Login prompt should be visible.
    await expect(page.getByText(/log in to your account/i)).toBeVisible({ timeout: 20_000 })
    const emailInput = page
      .getByRole('textbox', { name: /email/i })
      .or(page.getByPlaceholder(/your email/i))
      .first()
    await emailInput.fill(testData.users.user1.email)

    await clearTestMagicLinks(request, testData.users.user1.email)

    await page.getByRole('button', { name: /^submit$/i }).click()
    await expect(page.getByRole('heading', { name: /^magic link sent$/i })).toBeVisible({ timeout: 30_000 })

    const magicLink = await pollForTestMagicLink(request, testData.users.user1.email)
    await page.goto(magicLink.url, { waitUntil: 'domcontentloaded' })

    // Visual feedback on completion.
    await expect(page.getByText(/added to the waitlist/i)).toBeVisible({ timeout: 30_000 })

    // Return to schedule and verify schedule state.
    await page.getByRole('button', { name: /back to schedule/i }).click()
    await expect(page.getByRole('heading', { name: /^schedule$/i })).toBeVisible({ timeout: 20_000 })

    const dateLabelAfter = page.locator('p.text-center.text-lg').first()
    const nextDayButtonAfter = dateLabelAfter.locator('xpath=..').locator('svg').nth(1)

    for (let i = 0; i < 14; i += 1) {
      const current = (await dateLabelAfter.textContent())?.trim()
      if (current === targetLabel) break
      await nextDayButtonAfter.click()
      await expect(dateLabelAfter).toHaveText(targetLabel, { timeout: 10_000 }).catch(() => null)
    }
    await expect(dateLabelAfter).toHaveText(targetLabel, { timeout: 15_000 })

    const timeslotCardAfter = page
      .locator('div.border-b.border-border')
      .filter({ hasText: eventName })
      .first()

    await expect(timeslotCardAfter.getByRole('button', { name: /leave.*waitlist/i })).toBeVisible({
      timeout: 30_000,
    })
  })
})

