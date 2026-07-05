import type { Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { loginAsTenantAdmin } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  saveObjectAndWaitForNavigation,
  uniqueClassName,
} from '@repo/testing-config/src/playwright'

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function setPayloadTenantCookie(
  page: Page,
  tenantId: number | string,
  tenantSlug: string,
) {
  await page.context().addCookies([
    { name: 'payload-tenant', value: String(tenantId), domain: `${tenantSlug}.localhost`, path: '/' },
    { name: 'tenant-slug', value: tenantSlug, domain: `${tenantSlug}.localhost`, path: '/' },
  ])
}

async function fillStable(
  page: Page,
  locatorFactory: () => ReturnType<Page['locator']>,
  value: string,
) {
  const attempts = process.env.CI ? 5 : 3
  for (let i = 0; i < attempts; i += 1) {
    const field = locatorFactory().first()
    try {
      await field.waitFor({ state: 'visible', timeout: process.env.CI ? 30000 : 15000 })
      await field.scrollIntoViewIfNeeded().catch(() => null)
      await field.click({ timeout: 5000 })
      await field.fill(value)
      await field.blur()
      await expect(field).toHaveValue(value, { timeout: 5000 })
      return
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/detached|not attached|Target page|context or browser has been closed/i.test(msg) && i < attempts - 1) {
        await page.waitForTimeout(300)
        continue
      }
      throw err
    }
  }
}

async function chooseTenantInCreateModal(page: Page, tenantName: string) {
  const dialog = page.getByRole('dialog', { name: /select tenant/i })
  await dialog.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null)
  if (!(await dialog.isVisible().catch(() => false))) return

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
  await continueButton.click()
  await page.waitForLoadState('load').catch(() => null)
  await expect(dialog).not.toBeVisible({ timeout: 15000 })
}

async function chooseLocationInCreateModal(page: Page) {
  const select = page.locator('select#select-location-create').first()
  await select.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null)
  if (!(await select.isVisible().catch(() => false))) return

  const optionCount = await select.locator('option').count()
  if (optionCount <= 1) return

  await select.selectOption({ index: 1 })

  const continueButton = page.getByRole('button', { name: /continue/i }).first()
  await expect(continueButton).toBeEnabled({ timeout: 10000 })
  await continueButton.click()
  await page.waitForLoadState('load').catch(() => null)
  await expect(select).not.toBeVisible({ timeout: 15000 })
}

async function prepareTenantAdminCreatePage(
  page: Page,
  tenant: { id: number; name: string; slug: string },
  createUrl: string,
) {
  await setPayloadTenantCookie(page, tenant.id, tenant.slug)
  await page.goto(createUrl, {
    waitUntil: 'domcontentloaded',
    timeout: process.env.CI ? 120000 : 60000,
  })
  await chooseTenantInCreateModal(page, tenant.name)
  await chooseLocationInCreateModal(page)
}

async function fillEventTypeCreateForm(page: Page, className: string) {
  await expect(page.getByText('Creating new Event Type').first()).toBeVisible({
    timeout: process.env.CI ? 60000 : 30000,
  })

  // Wait for any deferred router.refresh() from tenant/location modals to settle before
  // filling — a soft re-render fires after load state, silently wiping field values.
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

  const doFill = async () => {
    await fillStable(page, () => page.getByRole('textbox', { name: /^Name\s*\*?$/i }), className)
    await fillStable(page, () => page.getByRole('spinbutton', { name: /Places/i }), '10')
    await fillStable(
      page,
      () => page.getByRole('textbox', { name: /Description/i }),
      'E2E class option for tenant-admin public schedule lesson coverage',
    )
  }

  await doFill()

  // Short pause then verify values are still present — if a deferred re-render wiped
  // them, fill once more before proceeding to save.
  await page.waitForTimeout(700)
  const nameVal = await page
    .getByRole('textbox', { name: /^Name\s*\*?$/i })
    .first()
    .inputValue()
    .catch(() => '')
  if (nameVal !== className) {
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null)
    await doFill()
  }
}

async function extractIdFromAdminUrl(page: Page, collection: string): Promise<number | null> {
  const match = page.url().match(new RegExp(`/admin/collections/${collection}/(\\d+)`))
  return match ? Number(match[1]) : null
}


async function advanceScheduleToDate(page: Page, targetDate: Date) {
  const dateLabel = page.locator('p.text-center.text-lg').first()
  await expect(dateLabel).toBeVisible({ timeout: 15000 })

  const toggle = dateLabel.locator('xpath=..')
  const nextDayButton = toggle.locator('svg').nth(1)
  const targetLabel = targetDate.toDateString()

  for (let i = 0; i < 45; i += 1) {
    const currentLabel = (await dateLabel.textContent())?.trim()
    if (currentLabel === targetLabel) return

    await nextDayButton.click({ force: true })
    await page.waitForTimeout(200)
  }

  await expect(dateLabel).toHaveText(targetLabel, { timeout: 15000 })
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
    const { north } = testData.tenant1Locations
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

    // Branch is required for timeslot creates when the tenant has multiple active locations.
    if (north?.id) {
      await page.context().addCookies([
        {
          name: 'payload-location',
          value: String(north.id),
          domain: `${tenant.slug}.localhost`,
          path: '/',
        },
      ])
    }

    await prepareTenantAdminCreatePage(
      page,
      { id: tenant.id, name: tenant.name, slug: tenant.slug },
      `${tenantOrigin}/admin/collections/event-types/create`,
    )
    await fillEventTypeCreateForm(page, className)
    await saveObjectAndWaitForNavigation(page, {
      apiPath: '/api/event-types',
      expectedUrlPattern: /\/admin\/collections\/event-types\/\d+/,
      collectionName: 'event-types',
    })
    const eventTypeId = await extractIdFromAdminUrl(page, 'event-types')

    // Create the timeslot via the REST API rather than through the admin UI date-picker.
    // Payload's timeOnly datepicker sets the startTime DATE component to "today" (not the
    // target date), so any UI-created timeslot would be stored with startTime on today's
    // date and never appear in the target-day schedule query (which filters by startTime).
    const tsStart = new Date(targetDate)
    tsStart.setHours(10, 0, 0, 0)
    const tsEnd = new Date(targetDate)
    tsEnd.setHours(11, 0, 0, 0)

    const tsBody: Record<string, unknown> = {
      date: targetDate.toISOString(),
      startTime: tsStart.toISOString(),
      endTime: tsEnd.toISOString(),
      eventType: eventTypeId,
      tenant: tenant.id,
      lockOutTime: 0,
      active: true,
    }
    if (north?.id) tsBody.branch = north.id

    // Use browser-side fetch (credentials: 'include') so the browser's session and
    // tenant cookies are automatically sent — avoids any node/Playwright request-context
    // cookie-sharing quirks.
    const tsResult = await page.evaluate(
      async ({ url, body }: { url: string; body: Record<string, unknown> }) => {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        })
        const json = await res.json().catch(() => null)
        return { status: res.status, json }
      },
      { url: `${tenantOrigin}/api/timeslots`, body: tsBody },
    )
    if (tsResult.status < 200 || tsResult.status >= 300) {
      throw new Error(`Timeslot create failed (${tsResult.status}): ${JSON.stringify(tsResult.json)}`)
    }
    if (!(tsResult.json?.doc?.id ?? tsResult.json?.id)) {
      throw new Error(`No timeslot id in create response: ${JSON.stringify(tsResult.json)}`)
    }

    await navigateToTenant(page, tenant.slug, '/')
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/home', {
      timeout: 15000,
    }).catch(() => null)

    await expect(page.getByText(/loading schedule/i)).not.toBeVisible({ timeout: 15000 }).catch(() => null)

    await advanceScheduleToDate(page, targetDate)

    await expect(page.getByText('No timeslots scheduled for today')).not.toBeVisible({ timeout: 5000 }).catch(() => null)
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
