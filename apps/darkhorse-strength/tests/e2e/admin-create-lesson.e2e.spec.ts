import { test, expect } from '@playwright/test'
import {
  createEventType,
  ensureAdminLoggedIn,
  saveTimeslot,
  saveObjectAndWaitForNavigation,
  setTimeslotDateAndTime,
  selectEventTypeInTimeslotForm,
  uniqueClassName,
} from '@repo/testing-config/src/playwright'
import { getTimeslotsQuery } from '@repo/shared-utils'

test.describe('Darkhorse Strength: admin lesson creation', () => {
  test.setTimeout(180000)

  test('lesson created from /create appears on the selected future date in the timeslots dashboard', async ({
    page,
  }) => {
    await ensureAdminLoggedIn(page)

    const className = uniqueClassName('Darkhorse Admin Timeslot')
    await createEventType(page, {
      name: className,
      description: 'E2E class option for admin lesson creation date coverage',
    })
    await saveObjectAndWaitForNavigation(page, {
      apiPath: '/api/event-types',
      expectedUrlPattern: /\/admin\/collections\/event-types\/\d+/,
      collectionName: 'event-types',
    })

    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + 3)
    targetDate.setHours(0, 0, 0, 0)

    await page.goto('/admin/collections/timeslots/create', {
      waitUntil: 'domcontentloaded',
      timeout: process.env.CI ? 120000 : 60000,
    })

    await selectEventTypeInTimeslotForm(page, className)
    await setTimeslotDateAndTime(page, targetDate)
    await saveTimeslot(page)

    await page.goto(
      `/admin/collections/timeslots${getTimeslotsQuery(targetDate, undefined, { depth: 0 })}`,
      {
        waitUntil: 'domcontentloaded',
        timeout: process.env.CI ? 120000 : 60000,
      },
    )

    await expect(page.getByRole('heading', { name: /timeslots/i }).first()).toBeVisible({
      timeout: process.env.CI ? 120000 : 60000,
    })
    await expect(page.getByRole('cell', { name: className }).first()).toBeVisible({
      timeout: process.env.CI ? 120000 : 60000,
    })
  })
})
