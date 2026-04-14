import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

const isCI = Boolean(
  (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env?.CI,
)

export const adminTenantSelectorCI = {
  sidebarTimeout: isCI ? 25_000 : 20_000,
  clearTimeout: isCI ? 20_000 : 10_000,
  clearedStateDurationMs: isCI ? 10_000 : 6_000,
}

export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function getTenantSelector(page: Page) {
  return page.getByTestId('tenant-selector')
}

export async function ensureSidebarOpen(page: Page) {
  await page.waitForLoadState('domcontentloaded').catch(() => null)
  if (isCI) await page.waitForTimeout(250)

  const tenantSelector = getTenantSelector(page)
  if (await tenantSelector.isVisible().catch(() => false)) {
    return
  }

  const openMenuButton = page.getByRole('button', { name: /open\s+menu/i })

  if (await openMenuButton.isVisible().catch(() => false)) {
    await openMenuButton.click({ timeout: 10_000 }).catch(() => null)
  }

  await expect(tenantSelector).toBeVisible({ timeout: adminTenantSelectorCI.sidebarTimeout })
}

export async function clearTenantSelectionFromUI(page: Page) {
  const wrap = getTenantSelector(page)
  await page.waitForTimeout(1000)
  const combobox = wrap.getByRole('combobox').or(wrap).first()
  const origin = new URL(page.url()).origin
  const cookieURLs = [`${origin}/`, `${origin}/admin/`, `${origin}/admin/collections/`, page.url()]

  const isPayloadTenantCleared = async () => {
    const cookies = await page.context().cookies(cookieURLs)
    const tenantCookies = cookies.filter((cookie) => cookie.name === 'payload-tenant')
    return tenantCookies.length === 0 || tenantCookies.every((cookie) => !cookie.value)
  }

  const waitForLeaveAnywayDialog = async () => {
    const leaveAnyway = page.getByRole('button', { name: /leave anyway/i })
    if (await leaveAnyway.isVisible().catch(() => false)) {
      await leaveAnyway.click()
    }
  }

  const buttons = wrap.getByRole('button')
  const buttonCount = await buttons.count()

  const tryClear = async (locator: ReturnType<typeof wrap.locator>) => {
    if (!(await locator.isVisible().catch(() => false))) return false

    const clearResponsePromise = page
      .waitForResponse(
        (response) =>
          response.url().includes('/api/admin/clear-tenant-cookie') &&
          response.request().method() === 'POST',
        { timeout: adminTenantSelectorCI.clearTimeout },
      )
      .catch(() => null)

    await locator.dispatchEvent('mousedown').catch(() => null)
    await locator.click({ timeout: 10_000, force: true }).catch(() => null)
    await clearResponsePromise
    await waitForLeaveAnywayDialog()

    try {
      await expect.poll(isPayloadTenantCleared, { timeout: adminTenantSelectorCI.clearTimeout }).toBe(true)
      return true
    } catch {
      return false
    }
  }

  const ariaClear = wrap.locator('button[aria-label*="Clear"], button[title*="Clear"]').first()
  let cleared = await tryClear(ariaClear)

  if (!cleared && buttonCount > 0) {
    for (let index = 0; index < buttonCount; index += 1) {
      cleared = await tryClear(buttons.nth(index))
      if (cleared) break
    }
  }

  if (!cleared) {
    const box = await combobox.boundingBox().catch(() => null)
    if (box) {
      await page.mouse.click(box.x + box.width - 18, box.y + box.height / 2)
      await waitForLeaveAnywayDialog()
      try {
        await expect.poll(isPayloadTenantCleared, { timeout: adminTenantSelectorCI.clearTimeout }).toBe(true)
        cleared = true
      } catch {
        cleared = false
      }
    }
  }

  if (!cleared) {
    await combobox.focus().catch(() => null)
    await page.keyboard.press('Backspace').catch(() => null)
    await page.keyboard.press('Backspace').catch(() => null)
    await waitForLeaveAnywayDialog()
  }

  await page.waitForLoadState('load').catch(() => null)
  await page
    .evaluate(async () => {
      try {
        await fetch('/api/admin/clear-tenant-cookie', {
          method: 'POST',
          credentials: 'include',
        })
      } catch {
        // Ignore if the clear route is temporarily unavailable during navigation.
      }
    })
    .catch(() => null)

  await expect.poll(isPayloadTenantCleared, { timeout: adminTenantSelectorCI.clearTimeout }).toBe(true)
  await page.keyboard.press('Escape').catch(() => null)
}
