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

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function pickLessonTime(
  page: any,
  fieldId: 'startTime' | 'endTime',
  labels: string[],
) {
  const input = page.locator(`#field-${fieldId}`).getByRole('textbox')
  await input.click()
  await page.waitForTimeout(200)

  // Payload frequently uses react-datepicker; prefer clicking the time list item.
  for (const label of labels) {
    const timeItem = page.locator(`.react-datepicker__time-list-item:has-text("${label}")`).first()
    if ((await timeItem.count()) > 0) {
      await timeItem.click()
      await page.waitForTimeout(200)
      if (((await input.inputValue().catch(() => '')) || '').trim() !== '') return input
    }
  }

  // Fallback: type into the input (some setups accept direct typing).
  for (const label of labels) {
    await input.clear().catch(() => {})
    await input.fill(label)
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(200)
    if (((await input.inputValue().catch(() => '')) || '').trim() !== '') return input
  }

  return input
}

export async function createClassOption(
  page: Page,
  options: { name: string; description: string; places?: string; readyPath?: string },
): Promise<void> {
  const { name, description, places = '10', readyPath = '/api/health' } = options
  const p: any = page as any

  await waitForServerReady(p.context().request, { path: readyPath })
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

export async function setLessonDateAndTime(
  page: Page,
  targetDate: Date,
  options?: {
    startLabels?: string[]
    endLabels?: string[]
  },
): Promise<void> {
  const p: any = page as any
  const targetDateStr = targetDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const dateInput = p.locator('#field-date').getByRole('textbox')
  await dateInput.click()
  await dateInput.clear().catch(() => {})
  await dateInput.fill(targetDateStr)
  await p.keyboard.press('Tab')
  await p.waitForTimeout(300)
  await expect(dateInput).not.toHaveValue('', { timeout: 10000 })

  const startTimeInput = await pickLessonTime(p, 'startTime', options?.startLabels ?? ['10:00 AM', '10:00'])
  await expect(startTimeInput).not.toHaveValue('', { timeout: 10000 })

  const endTimeInput = await pickLessonTime(p, 'endTime', options?.endLabels ?? ['11:00 AM', '11:00'])
  await expect(endTimeInput).not.toHaveValue('', { timeout: 10000 })
}

/**
 * Set the lesson date to tomorrow and time to 10:00–11:00.
 * Returns the Date instance for tomorrow.
 */
export async function setLessonTomorrowAtTenToEleven(page: Page): Promise<Date> {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  await setLessonDateAndTime(page, tomorrow)

  return tomorrow
}

export async function selectClassOptionInLessonForm(page: Page, className: string): Promise<void> {
  const p: any = page as any
  const classOptionCombobox = p.locator('text=Class Option').locator('..').locator('[role="combobox"]').first()

  await expect(classOptionCombobox).toBeVisible({ timeout: 20000 })
  await classOptionCombobox.click()
  await classOptionCombobox.fill(className)

  const option = p
    .getByRole('listbox')
    .getByRole('option', { name: new RegExp(`^${escapeRegex(className)}$`) })
    .first()
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

/**
 * Create a lesson via the REST API (avoids flaky admin date/time pickers).
 * Returns the created lesson ID.
 */
export async function createLessonViaApi(
  page: Page,
  opts: {
    classOptionId: number
    date: Date
    startHour: number
    startMinute: number
    endHour: number
    endMinute: number
  },
): Promise<number> {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const request: any = (page.context() as any).request
  const adminEmail = `admin@example.com`
  const adminPassword = 'password123'

  const cookieHeader = async () => {
    const cookies: Array<{ name: string; value: string }> = await (page.context() as any).cookies()
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ')
  }

  const adminAuthHeader = async (): Promise<Record<string, string>> => {
    try {
      const res = await request.post(`${baseUrl}/api/users/login`, {
        headers: { Cookie: await cookieHeader(), 'Content-Type': 'application/json' },
        data: { email: adminEmail, password: adminPassword },
        timeout: 30000,
      })
      if (!res.ok()) return {}
      const json: any = await res.json().catch(() => null)
      const token = json?.token ?? json?.doc?.token ?? json?.user?.token
      if (!token || typeof token !== 'string') return {}
      return { Authorization: `JWT ${token}` }
    } catch {
      return {}
    }
  }

  const start = new Date(opts.date)
  start.setHours(opts.startHour, opts.startMinute, 0, 0)
  const end = new Date(opts.date)
  end.setHours(opts.endHour, opts.endMinute, 0, 0)

  const res = await request.post(`${baseUrl}/api/lessons`, {
    headers: {
      ...(await adminAuthHeader()),
      Cookie: await cookieHeader(),
      'Content-Type': 'application/json',
    },
    data: {
      date: opts.date.toISOString(),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      classOption: opts.classOptionId,
      lockOutTime: 0,
      active: true,
    },
  })

  if (!res.ok()) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Failed to create lesson via API: ${res.status()} ${txt}`)
  }

  const json: any = await res.json().catch(() => null)
  const id = json?.doc?.id ?? json?.id
  if (id == null) throw new Error(`Unexpected create lesson response: ${JSON.stringify(json)}`)
  return Number(id)
}


