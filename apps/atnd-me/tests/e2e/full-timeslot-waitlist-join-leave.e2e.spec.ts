import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { loginAsRegularUser } from './helpers/auth-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  createTestBooking,
} from './helpers/data-helpers'

/**
 * Schedule UX: full timeslot → Join Waitlist → Leave Waitlist (still full → Join shows again).
 */
test.describe('Full timeslot waitlist', () => {
  test.setTimeout(120000)

  test('user joins waitlist on a full slot then leaves it', async ({ page, testData }) => {
    const tenant = testData.tenants[0]!
    const workerIndex = testData.workerIndex
    const w = workerIndex

    const eventType = await createTestEventType(
      tenant.id,
      'Waitlist Join Leave Class',
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

    await loginAsRegularUser(page, 1, testData.users.user1.email, 'password', {
      tenantSlug: tenant.slug,
    })
    await navigateToTenant(page, tenant.slug, '/')

    await expect(page.getByRole('heading', { name: /^schedule$/i })).toBeVisible({ timeout: 20000 })

    const dateLabel = page.locator('p.text-center.text-lg').first()
    await expect(dateLabel).toBeVisible({ timeout: 30000 })
    const nextDayButton = dateLabel.locator('xpath=..').locator('svg').nth(1)
    const targetLabel = startTime.toDateString()

    for (let i = 0; i < 14; i += 1) {
      const current = (await dateLabel.textContent())?.trim()
      if (current === targetLabel) break
      await nextDayButton.click()
      await expect(dateLabel).toHaveText(targetLabel, { timeout: 10000 }).catch(() => null)
    }
    await expect(dateLabel).toHaveText(targetLabel, { timeout: 15000 })

    const timeslotCard = page.locator('div.border-b.border-border').filter({ hasText: eventName }).first()
    await expect(timeslotCard).toBeVisible({ timeout: 20000 })

    const joinBtn = timeslotCard.getByRole('button', { name: /join waitlist/i })
    await expect(joinBtn).toBeVisible()
    await expect(joinBtn).toBeEnabled()
    await joinBtn.click()

    await expect(timeslotCard.getByRole('button', { name: /leave waitlist/i })).toBeVisible({
      timeout: 20000,
    })

    await timeslotCard.getByRole('button', { name: /leave waitlist/i }).click()

    await expect(timeslotCard.getByRole('button', { name: /join waitlist/i })).toBeVisible({
      timeout: 20000,
    })
  })
})
