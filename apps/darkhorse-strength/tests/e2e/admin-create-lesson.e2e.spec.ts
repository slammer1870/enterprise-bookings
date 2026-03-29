import { test, expect } from '@playwright/test'
import {
  createClassOption,
  ensureAdminLoggedIn,
  saveLesson,
  saveObjectAndWaitForNavigation,
  setLessonDateAndTime,
  selectClassOptionInLessonForm,
  uniqueClassName,
} from '@repo/testing-config/src/playwright'
import { getLessonsQuery } from '@repo/shared-utils'

test.describe('Darkhorse Strength: admin lesson creation', () => {
  test.setTimeout(180000)

  test('lesson created from /create appears on the selected future date in the lessons dashboard', async ({
    page,
  }) => {
    await ensureAdminLoggedIn(page)

    const className = uniqueClassName('Darkhorse Admin Lesson')
    await createClassOption(page, {
      name: className,
      description: 'E2E class option for admin lesson creation date coverage',
    })
    await saveObjectAndWaitForNavigation(page, {
      apiPath: '/api/class-options',
      expectedUrlPattern: /\/admin\/collections\/class-options\/\d+/,
      collectionName: 'class-options',
    })

    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + 3)
    targetDate.setHours(0, 0, 0, 0)

    await page.goto('/admin/collections/lessons/create', {
      waitUntil: 'domcontentloaded',
      timeout: process.env.CI ? 120000 : 60000,
    })

    await selectClassOptionInLessonForm(page, className)
    await setLessonDateAndTime(page, targetDate)
    await saveLesson(page)

    await page.goto(`/admin/collections/lessons${getLessonsQuery(targetDate)}`, {
      waitUntil: 'domcontentloaded',
      timeout: process.env.CI ? 120000 : 60000,
    })

    await expect(page.getByRole('heading', { name: /lessons/i }).first()).toBeVisible({
      timeout: process.env.CI ? 120000 : 60000,
    })
    await expect(page.getByRole('cell', { name: className }).first()).toBeVisible({
      timeout: process.env.CI ? 120000 : 60000,
    })
  })
})
