import { test, expect } from './helpers/fixtures'
import { loginAsSuperAdmin, BASE_URL } from './helpers/auth-helpers'
import {
  saveLesson,
  saveObjectAndWaitForNavigation,
  setLessonDateAndTime,
  selectClassOptionInLessonForm,
  uniqueClassName,
} from '@repo/testing-config/src/playwright'

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function formatCalendarButtonLabel(date: Date): string {
  const weekdays = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ]
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  const day = date.getDate()
  const mod100 = day % 100
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? 'th'
      : day % 10 === 1
        ? 'st'
        : day % 10 === 2
          ? 'nd'
          : day % 10 === 3
            ? 'rd'
            : 'th'

  return `${weekdays[date.getDay()]}, ${months[date.getMonth()]} ${day}${suffix}, ${date.getFullYear()}`
}

function getTenantSelector(page: Parameters<typeof test>[0]['page']) {
  return page.getByTestId('tenant-selector')
}

async function ensureSidebarOpen(page: Parameters<typeof test>[0]['page']) {
  await page.waitForLoadState('domcontentloaded').catch(() => null)

  if (await getTenantSelector(page).isVisible().catch(() => false)) {
    return
  }

  const openMenuButton = page.getByRole('button', { name: /open\s+menu/i })
  const closeMenuButton = page.getByRole('button', { name: /close\s+menu/i })

  await Promise.race([
    openMenuButton.waitFor({ state: 'visible', timeout: 10_000 }),
    closeMenuButton.waitFor({ state: 'visible', timeout: 10_000 }),
  ]).catch(() => null)

  if (await openMenuButton.isVisible().catch(() => false)) {
    await openMenuButton.click({ timeout: 10_000 }).catch(() => null)
    await closeMenuButton.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => null)
    await page.waitForTimeout(250)
  }

  await getTenantSelector(page).waitFor({ state: 'visible', timeout: 20_000 })
}

async function chooseTenantInCreateModal(page: Parameters<typeof test>[0]['page'], tenantName: string) {
  const dialog = page.getByRole('dialog', { name: /select tenant/i })
  await expect(dialog).toBeVisible({ timeout: 10000 })

  const combobox = dialog.getByRole('combobox').first()
  await combobox.click({ timeout: 5000 })
  await combobox.focus()
  await page.keyboard.press('Meta+A').catch(() => null)
  await page.keyboard.press('Control+A').catch(() => null)
  await page.keyboard.type(tenantName, { delay: 30 })
  await page.waitForTimeout(300)

  const option = page.getByRole('option', { name: new RegExp(escapeRegex(tenantName), 'i') }).first()
  const optionVisible = await option.isVisible().catch(() => false)
  if (optionVisible) {
    await option.click()
  } else {
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
  }

  const continueButton = dialog.getByRole('button', { name: /continue/i })
  await expect(continueButton).toBeEnabled({ timeout: 10000 })
  await continueButton.click()
  await page.waitForLoadState('load').catch(() => null)
  await expect(dialog).not.toBeVisible({ timeout: 15000 })
}

async function ensureTenantSelectedForCreate(
  page: Parameters<typeof test>[0]['page'],
  tenant: { id: number; name: string; slug?: string | null },
) {
  const dialog = page.getByRole('dialog', { name: /select tenant/i })
  const modalVisible = await dialog.isVisible().catch(() => false)
  if (modalVisible) {
    await chooseTenantInCreateModal(page, tenant.name)
    return
  }

  const { hostname, origin } = new URL(page.url())
  const isTenantHost = hostname.endsWith('.localhost') && hostname !== 'localhost'
  if (isTenantHost) {
    return
  }

  await page.context().addCookies([
    { name: 'payload-tenant', value: String(tenant.id), url: `${origin}/` },
    { name: 'payload-tenant', value: String(tenant.id), url: `${origin}/admin/` },
    { name: 'payload-tenant', value: String(tenant.id), url: `${origin}/admin/collections/` },
  ])
  await page.reload({ waitUntil: 'load' })
  await ensureSidebarOpen(page)
  await expect(
    getTenantSelector(page).getByText(new RegExp(escapeRegex(tenant.name), 'i')).first(),
  ).toBeVisible({ timeout: 20_000 })
}

async function openLessonsDashboardForDate(
  page: Parameters<typeof test>[0]['page'],
  targetDate: Date,
) {
  await page.goto('/admin/collections/lessons', {
    waitUntil: 'domcontentloaded',
    timeout: process.env.CI ? 120000 : 60000,
  })

  await expect(page.getByRole('heading', { name: /lessons/i }).first()).toBeVisible({
    timeout: process.env.CI ? 120000 : 60000,
  })

  const monthStatus = page.getByRole('status').first()
  const nextMonthButton = page.getByRole('button', { name: /go to the next month/i })
  const targetMonthLabel = targetDate.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  for (let i = 0; i < 12; i += 1) {
    const visibleMonth = (await monthStatus.textContent())?.trim()
    if (visibleMonth === targetMonthLabel) break
    await nextMonthButton.click()
  }

  await expect(monthStatus).toHaveText(targetMonthLabel, {
    timeout: process.env.CI ? 120000 : 60000,
  })

  const targetDateLabel = formatCalendarButtonLabel(targetDate)
  await page.getByRole('button', { name: new RegExp(`^${escapeRegex(targetDateLabel)}$`) }).click()
}

test.describe('Admin lesson creation date regression', () => {
  test.setTimeout(180000)

  test('lesson created from /create appears on the selected future date in the lessons dashboard', async ({
    page,
    request,
    testData,
  }) => {
    await loginAsSuperAdmin(page, testData.users.superAdmin.email, { request })
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'load' })

    const tenant = testData.tenants[0]
    if (!tenant?.id || !tenant?.name) throw new Error('Expected tenant fixture for admin lesson creation test')

    const className = uniqueClassName('ATND Admin Lesson')
    await page.goto('/admin/collections/class-options/create', {
      waitUntil: 'domcontentloaded',
      timeout: process.env.CI ? 120000 : 60000,
    })
    await ensureTenantSelectedForCreate(page, tenant)
    await page.getByRole('textbox', { name: /^Name\s*\*?$/i }).fill(className)
    await page.getByRole('spinbutton', { name: /Places/i }).fill('10')
    await page
      .getByRole('textbox', { name: /Description/i })
      .fill('E2E class option for shared admin lesson date regression coverage')
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

    await ensureTenantSelectedForCreate(page, tenant)
    await selectClassOptionInLessonForm(page, className)
    await setLessonDateAndTime(page, targetDate)
    await saveLesson(page)

    await openLessonsDashboardForDate(page, targetDate)

    await expect(page.getByRole('cell', { name: className }).first()).toBeVisible({
      timeout: process.env.CI ? 120000 : 60000,
    })
  })
})
