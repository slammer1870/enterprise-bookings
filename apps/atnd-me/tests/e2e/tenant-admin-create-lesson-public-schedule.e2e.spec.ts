import type { Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { loginAsTenantAdmin } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  setLessonDateAndTime,
  uniqueClassName,
} from '@repo/testing-config/src/playwright'

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function waitForModalOverlayToClear(page: Page) {
  await expect(page.locator('.payload__modal-container')).toHaveCount(0, { timeout: 15000 }).catch(() => null)
  await page
    .evaluate(() => {
      document.querySelectorAll('.payload__modal-container').forEach((node) => {
        ;(node as HTMLElement).style.pointerEvents = 'none'
      })
    })
    .catch(() => null)
  await page.waitForTimeout(300)
}

async function scrollToTopBeforeSave(page: Page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }))
  await page.waitForTimeout(200)
}

async function saveObjectWithOverlayBypass(
  page: Page,
  options: {
    apiPath: string
    expectedUrlPattern: RegExp
    collectionName: string
  },
) {
  const { apiPath, expectedUrlPattern, collectionName } = options
  const saveButton = page.getByRole('button', { name: 'Save' })
  const navigationTimeout = process.env.CI ? 120000 : 60000

  await saveButton.waitFor({ state: 'visible', timeout: 30000 })
  await expect(saveButton).toBeEnabled({ timeout: 10000 }).catch(() => page.waitForTimeout(1000))
  await scrollToTopBeforeSave(page)
  await waitForModalOverlayToClear(page)

  const requestPromise = page
    .waitForRequest((request) => {
      const url = request.url()
      const method = request.method()
      return method === 'POST' && url.includes(apiPath) && !url.includes(`${apiPath}/`)
    }, { timeout: navigationTimeout })
    .catch(() => null)

  const responsePromise = page
    .waitForResponse(
      (response) => {
        const url = response.url()
        const method = response.request().method()
        const status = response.status()
        return method === 'POST' && url.includes(apiPath) && !url.includes(`${apiPath}/`) && status === 201
      },
      { timeout: navigationTimeout },
    )
    .catch(() => null)

  await saveButton.click({ force: true })

  let objectId: number | null = null
  const request = await requestPromise
  try {
    const response = await responsePromise
    if (response) {
      const responseBody: { doc?: { id?: number | string }; id?: number | string } = await response.json()
      const rawId = responseBody?.doc?.id ?? responseBody?.id ?? null
      objectId = rawId == null ? null : Number(rawId)
    }
  } catch {
    // ignore and fall back to URL handling
  }

  await page.waitForLoadState('load', { timeout: process.env.CI ? 30000 : 15000 }).catch(() => null)

  try {
    await expect(page).toHaveURL(expectedUrlPattern, {
      timeout: process.env.CI ? 30000 : 10000,
    })
  } catch {
    if (objectId !== null) {
      const editUrl = `/admin/collections/${collectionName}/${objectId}`
      await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: navigationTimeout })
      await expect(page).toHaveURL(editUrl, { timeout: process.env.CI ? 30000 : 10000 })
      return
    }
    throw new Error(`Failed to navigate to ${collectionName} edit page. Current URL: ${page.url()}`)
  }
}

async function openCreateFromCollectionList(
  page: Page,
  listUrl: string,
  headingName: RegExp,
  createName: RegExp,
) {
  await page.goto(listUrl, {
    waitUntil: 'domcontentloaded',
    timeout: process.env.CI ? 120000 : 60000,
  })
  await expect(page.getByRole('heading', { name: headingName }).first()).toBeVisible({
    timeout: process.env.CI ? 120000 : 60000,
  })

  const createLink = page.getByRole('link', { name: createName }).first()
  const createButton = page.getByRole('button', { name: createName }).first()

  if (await createLink.isVisible().catch(() => false)) {
    await createLink.click()
  } else {
    await createButton.click()
  }
  await page.waitForLoadState('domcontentloaded').catch(() => null)
}

async function chooseTenantInCreateModal(
  page: Page,
  tenantName: string,
) {
  const createPath = new URL(page.url()).pathname
  const dialog = page.getByRole('dialog', { name: /select tenant/i })
  await dialog.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null)
  const isVisible = await dialog.isVisible().catch(() => false)
  if (!isVisible) return

  const combobox = dialog.getByRole('combobox').first()
  await combobox.click({ timeout: 5000 })
  await combobox.focus()
  await page.keyboard.press('Meta+A').catch(() => null)
  await page.keyboard.press('Control+A').catch(() => null)
  await page.keyboard.type(tenantName, { delay: 30 })
  await page.waitForTimeout(300)

  const option = page.getByRole('option', { name: new RegExp(escapeRegex(tenantName), 'i') }).first()
  if (await option.isVisible().catch(() => false)) {
    await option.click()
  } else {
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
  }

  const continueButton = dialog.getByRole('button', { name: /continue/i })
  await expect(continueButton).toBeEnabled({ timeout: 10000 })
  const reloadPromise = page
    .waitForURL((url) => url.pathname === createPath, {
      timeout: 15000,
    })
    .catch(() => null)
  await continueButton.click()
  await reloadPromise
  await page.waitForLoadState('domcontentloaded').catch(() => null)
  await page.waitForLoadState('load').catch(() => null)
  await expect(dialog).not.toBeVisible({ timeout: 15000 })
  await waitForModalOverlayToClear(page)
}

async function advanceScheduleToDate(
  page: Page,
  targetDate: Date,
) {
  const dateLabel = page.locator('p.text-center.text-lg').first()
  await expect(dateLabel).toBeVisible({ timeout: 15000 })

  const toggle = dateLabel.locator('xpath=..')
  const nextDayButton = toggle.locator('svg').nth(1)
  const targetLabel = targetDate.toDateString()

  for (let i = 0; i < 14; i += 1) {
    const currentLabel = (await dateLabel.textContent())?.trim()
    if (currentLabel === targetLabel) return

    await nextDayButton.click()
    await expect(dateLabel).toHaveText(targetLabel, { timeout: 10000 }).catch(() => null)
  }

  await expect(dateLabel).toHaveText(targetLabel, { timeout: 15000 })
}

async function selectLessonClassOption(
  page: Page,
  className: string,
) {
  const classOptionCombobox = page.getByRole('combobox').nth(1)
  const classOptionTrigger = classOptionCombobox.locator('xpath=../following-sibling::button[1]')
  const expectedOption = page.getByRole('option', { name: new RegExp(`^${escapeRegex(className)}$`) }).first()

  await expect(classOptionCombobox).toBeVisible({ timeout: 20000 })
  await classOptionTrigger.click({ force: true }).catch(() => null)
  await classOptionCombobox.click({ force: true })
  await classOptionCombobox.focus()
  await classOptionCombobox.press('Meta+A').catch(() => null)
  await classOptionCombobox.press('Control+A').catch(() => null)
  await classOptionCombobox.press('Backspace').catch(() => null)
  await classOptionCombobox.fill(className).catch(async () => {
    await page.keyboard.type(className, { delay: 30 })
  })

  await expect(expectedOption).toBeVisible({ timeout: 10000 })
  await expectedOption.click()
  await expect(page.getByText(className, { exact: true }).first()).toBeVisible({ timeout: 10000 })
}

test.describe('Tenant admin lesson creation appears on public schedule', () => {
  test.setTimeout(180000)

  test('tenant admin creates a future lesson in admin and a public user finds it on that date in the schedule', async ({
    page,
    request,
    testData,
  }) => {
    const tenant = testData.tenants[0]
    const tenantAdmin = testData.users.tenantAdmin1
    const tenantOrigin = `http://${tenant.slug}.localhost:3000`

    if (!tenant?.id || !tenant?.slug || !tenant?.name || !tenantAdmin?.email) {
      throw new Error('Expected tenant and tenant admin fixtures for public schedule lesson test')
    }

    const className = uniqueClassName(`ATND Public Schedule ${tenant.id}`)
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + 5)
    targetDate.setHours(0, 0, 0, 0)

    await loginAsTenantAdmin(page, 1, tenantAdmin.email, {
      request,
      password: 'password',
      tenantSlug: tenant.slug,
    })

    await openCreateFromCollectionList(
      page,
      `${tenantOrigin}/admin/collections/class-options`,
      /class options/i,
      /create new/i,
    )
    await chooseTenantInCreateModal(page, tenant.name)
    await page.getByRole('textbox', { name: /^Name\s*\*?$/i }).fill(className)
    await page.getByRole('spinbutton', { name: /Places/i }).fill('10')
    await page
      .getByRole('textbox', { name: /Description/i })
      .fill('E2E class option for tenant-admin public schedule lesson coverage')
    await saveObjectWithOverlayBypass(page, {
      apiPath: '/api/class-options',
      expectedUrlPattern: /\/admin\/collections\/class-options\/\d+/,
      collectionName: 'class-options',
    })

    await openCreateFromCollectionList(
      page,
      `${tenantOrigin}/admin/collections/lessons`,
      /lessons/i,
      /create new/i,
    )
    await chooseTenantInCreateModal(page, tenant.name)
    await waitForModalOverlayToClear(page)
    await selectLessonClassOption(page, className)
    await setLessonDateAndTime(page, targetDate)
    await saveObjectWithOverlayBypass(page, {
      apiPath: '/api/lessons',
      expectedUrlPattern: /\/admin\/collections\/lessons\/\d+/,
      collectionName: 'lessons',
    })

    await navigateToTenant(page, tenant.slug, '/')
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/home', {
      timeout: 15000,
    }).catch(() => null)

    await expect(page.getByText(/loading schedule/i)).not.toBeVisible({ timeout: 15000 }).catch(() => null)
    await expect(page.getByText(className)).toHaveCount(0)

    await advanceScheduleToDate(page, targetDate)

    await expect(page.getByText('No lessons scheduled for today')).not.toBeVisible({ timeout: 5000 }).catch(() => null)
    await expect(page.getByText(className).first()).toBeVisible({ timeout: 20000 })

    const lessonLink = page.locator(`a[href*="/bookings/"]:has-text("${className}")`).first()
    const hasBookingLink = await lessonLink.isVisible().catch(() => false)
    if (hasBookingLink) {
      await expect(lessonLink).toBeVisible({ timeout: 20000 })
    } else {
      await expect(page.getByRole('button', { name: 'Book' }).first()).toBeVisible({ timeout: 20000 })
    }
  })
})
