import { expect as pwExpect, type Page } from '@playwright/test'
import { saveObjectAndWaitForNavigation } from '../payload-admin.js'
import { waitForServerReady } from '../helpers/server.js'

// The Playwright type surface can vary across workspace packages (moduleResolution / exports),
// but runtime APIs are stable. Use `any` wrappers to keep helpers usable everywhere.
const expect: any = pwExpect

export function uniqueClassName(base: string): string {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`
  return `${base} ${suffix}`
}

export async function createClassOption(
  page: Page,
  options: { name: string; description: string; places?: string },
): Promise<void> {
  const { name, description, places = '10' } = options
  const p: any = page as any

  await waitForServerReady(p.context().request)
  await p.goto('/admin/collections/class-options', {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  })

  // "Create new Class Option" is sometimes a link (Payload variations)
  const createLink = p.getByRole('link', { name: /Create new.*Class Option/i })
  if ((await createLink.count()) > 0) {
    await createLink.first().click()
  } else {
    await p.getByLabel(/Create new.*Class Option/i).first().click()
  }

  await p.getByRole('textbox', { name: /^Name\s*\*?$/i }).waitFor({ state: 'visible', timeout: 20000 })
  await p.getByRole('textbox', { name: /^Name\s*\*?$/i }).fill(name)
  await p.getByRole('spinbutton', { name: /Places/i }).fill(places)
  await p.getByRole('textbox', { name: /Description/i }).fill(description)
}

/**
 * Set the lesson date to tomorrow and time to 10:00–11:00.
 * Returns the Date instance for tomorrow.
 */
export async function setLessonTomorrowAtTenToEleven(page: Page): Promise<Date> {
  const p: any = page as any
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  const tomorrowDateStr = tomorrow.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const dateInput = p.locator('#field-date').getByRole('textbox')
  await dateInput.click()
  await dateInput.clear().catch(() => {})
  await dateInput.fill(tomorrowDateStr)
  await p.keyboard.press('Tab')
  await p.waitForTimeout(300)
  await expect(dateInput).not.toHaveValue('', { timeout: 10000 })

  const pickTime = async (fieldId: 'startTime' | 'endTime', labels: string[]) => {
    const input = p.locator(`#field-${fieldId}`).getByRole('textbox')
    await input.click()
    await p.waitForTimeout(200)

    // Payload frequently uses react-datepicker; prefer clicking the time list item.
    for (const label of labels) {
      const timeItem = p.locator(`.react-datepicker__time-list-item:has-text("${label}")`).first()
      if ((await timeItem.count()) > 0) {
        await timeItem.click()
        await p.waitForTimeout(200)
        if (((await input.inputValue().catch(() => '')) || '').trim() !== '') return input
      }
    }

    // Fallback: type into the input (some setups accept direct typing).
    for (const label of labels) {
      await input.clear().catch(() => {})
      await input.fill(label)
      await p.keyboard.press('Enter')
      await p.keyboard.press('Tab')
      await p.waitForTimeout(200)
      if (((await input.inputValue().catch(() => '')) || '').trim() !== '') return input
    }

    return input
  }

  const startTimeInput = await pickTime('startTime', ['10:00 AM', '10:00'])
  await expect(startTimeInput).not.toHaveValue('', { timeout: 10000 })

  const endTimeInput = await pickTime('endTime', ['11:00 AM', '11:00'])
  await expect(endTimeInput).not.toHaveValue('', { timeout: 10000 })

  return tomorrow
}

export async function selectClassOptionInLessonForm(page: Page, className: string): Promise<void> {
  const p: any = page as any
  const classOptionCombobox = p.locator('text=Class Option').locator('..').locator('[role="combobox"]').first()

  await expect(classOptionCombobox).toBeVisible({ timeout: 20000 })
  await classOptionCombobox.click()

  const option = p.getByRole('option', { name: className })
  await expect(option).toBeVisible({ timeout: 20000 })
  await option.click()
}

export async function saveLesson(page: Page): Promise<void> {
  await saveObjectAndWaitForNavigation(page as any, {
    apiPath: '/api/lessons',
    expectedUrlPattern: /\/admin\/collections\/lessons\/\d+/,
    collectionName: 'lessons',
  })
}


