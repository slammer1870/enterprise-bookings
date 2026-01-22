import { expect, type Page } from '@playwright/test'
import {
  clearTestMagicLinks,
  clickAndWaitForNavigation,
  pollForTestMagicLink,
  saveObjectAndWaitForNavigation,
  waitForServerReady,
} from './helpers'
import { createLessonViaApi } from '@repo/testing-config/src/playwright'

const baseUrl = () => process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'

function parseIdFromUrl(url: string, segment: string): number | null {
  const re = new RegExp(`/${segment}/(\\d+)(?:/|$)`)
  const m = url.match(re)
  const id = m?.[1]
  return id != null ? parseInt(id, 10) : null
}

async function cookieHeader(page: Page): Promise<string> {
  const cookies = await page.context().cookies()
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ')
}

/**
 * Ensure there is a plan with type 'child' (or 'family') for children's bookings.
 * Creates one via API if none exists. Sets priceJSON for checkout.
 * Returns { planId, planName }.
 */
export async function ensureChildPlan(page: Page): Promise<{ planId: number; planName: string }> {
  await waitForServerReady(page.context().request)
  const request = page.context().request as any

  const ensurePlanHasStripePriceId = async (plan: {
    id: number | string
    name?: string
    priceJSON?: string | null
  }) => {
    const planId = plan?.id
    if (!planId) throw new Error(`Plan is missing id: ${JSON.stringify(plan)}`)
    try {
      const parsed = plan?.priceJSON ? JSON.parse(plan.priceJSON as string) : null
      if (parsed?.id && typeof parsed.id === 'string') return
    } catch {
      /* overwrite */
    }
    const fakeStripePriceId = `price_e2e_child_${Date.now()}`
    const patchRes = await request.patch(`${baseUrl()}/api/plans/${planId}`, {
      headers: { Cookie: await cookieHeader(page), 'Content-Type': 'application/json' },
      data: {
        priceJSON: JSON.stringify({
          id: fakeStripePriceId,
          unit_amount: 1500_00,
          type: 'recurring',
        }),
        skipSync: true,
      },
    })
    if (!patchRes.ok()) {
      const txt = await patchRes.text().catch(() => '')
      throw new Error(`Failed to patch plan "${plan?.name ?? planId}" priceJSON: ${patchRes.status()} ${txt}`)
    }
  }

  const listRes = await request.get(
    `${baseUrl()}/api/plans?where[type][in][0]=child&where[type][in][1]=family&limit=1&sort=-createdAt`,
    { headers: { Cookie: await cookieHeader(page) } },
  )
  if (listRes.ok()) {
    const json = await listRes.json().catch(() => null)
    const existing = json?.docs?.[0]
    if (existing?.id) {
      await ensurePlanHasStripePriceId(existing)
      return {
        planId: typeof existing.id === 'number' ? existing.id : parseInt(String(existing.id), 10),
        planName: existing?.name ?? 'Child Plan',
      }
    }
  }

  const planName = `E2E Child Plan ${Date.now()}`
  const createRes = await request.post(`${baseUrl()}/api/plans`, {
    headers: { Cookie: await cookieHeader(page), 'Content-Type': 'application/json' },
    data: {
      name: planName,
      status: 'active',
      type: 'child',
      priceInformation: { price: 1500, interval: 'month', intervalCount: 1 },
      skipSync: true,
      priceJSON: JSON.stringify({
        id: `price_e2e_child_${Date.now()}`,
        unit_amount: 1500_00,
        type: 'recurring',
      }),
    },
  })
  if (!createRes.ok()) {
    const txt = await createRes.text().catch(() => '')
    throw new Error(`Failed to create child plan via API: ${createRes.status()} ${txt}`)
  }
  const created = await createRes.json().catch(() => null)
  const id = created?.doc?.id ?? created?.id
  if (id == null) throw new Error(`Unexpected create plan response: ${JSON.stringify(created)}`)
  return { planId: typeof id === 'number' ? id : parseInt(String(id), 10), planName }
}

export type ChildLessonPayment = 'none' | 'dropIn' | 'subscription'

/**
 * Ensure there is a child-type lesson tomorrow. Creates class option (type: child) and lesson.
 * Optional payment: none | dropIn | subscription.
 * Returns { lessonId, tomorrow, className }.
 */
export async function ensureLessonForTomorrowChild(
  page: Page,
  opts: { payment?: ChildLessonPayment; places?: number } = {},
): Promise<{ lessonId: number; tomorrow: Date; className: string }> {
  const payment = opts.payment ?? 'none'
  const places = opts.places ?? 10
  await waitForServerReady(page.context().request)

  const className = `E2E Child Class ${Date.now()}`
  let planName: string | null = null
  let dropInName: string | null = null

  if (payment === 'subscription') {
    const p = await ensureChildPlan(page)
    planName = p.planName
  }
  if (payment === 'dropIn') {
    dropInName = await ensureAtLeastOneDropIn(page)
  }

  await page.goto('/admin/collections/class-options', {
    waitUntil: 'load',
    timeout: process.env.CI ? 120000 : 60000,
  })
  const createLink = page.getByRole('link', { name: /Create new.*Class Option/i })
  if ((await createLink.count()) > 0) {
    await clickAndWaitForNavigation(page, createLink.first(), /\/admin\/collections\/class-options\/create/, {
      timeout: process.env.CI ? 120000 : 60000,
      waitUntil: 'domcontentloaded',
    })
  } else {
    await page.getByLabel(/Create new.*Class Option/i).first().click()
    await page.waitForURL(/\/admin\/collections\/class-options\/create/, {
      timeout: process.env.CI ? 60000 : 30000,
      waitUntil: 'domcontentloaded',
    })
  }

  const nameField = page.getByRole('textbox', { name: /^Name\s*\*?$/i })
  await nameField.waitFor({ state: 'visible', timeout: process.env.CI ? 30000 : 10000 })
  await nameField.fill(className)
  await page.getByRole('spinbutton', { name: /Places/i }).fill(String(places))
  await page.getByRole('textbox', { name: /Description/i }).fill('E2E child class for children bookings')

  const typeCombobox = page.locator('text=Type').locator('..').locator('[role="combobox"]').first()
  if ((await typeCombobox.count()) > 0) {
    await typeCombobox.click()
    const childOpt = page.getByRole('option', { name: /^child$/i })
    if ((await childOpt.count()) > 0) {
      await childOpt.click()
    } else {
      const first = page.getByRole('option').first()
      await first.click()
    }
  }

  if (payment === 'dropIn' && dropInName) {
    const allowedDropIn = page.locator('text=Allowed Drop In').locator('..').locator('[role="combobox"]').first()
    if ((await allowedDropIn.count()) > 0) {
      await allowedDropIn.click()
      const opt = page.getByRole('option', { name: new RegExp(dropInName, 'i') })
      if ((await opt.count()) > 0) await opt.first().click()
      else await page.getByRole('option').first().click()
    }
  }

  if (payment === 'subscription' && planName) {
    const allowedPlans = page.locator('text=Allowed Plans').locator('..').locator('[role="combobox"]').first()
    if ((await allowedPlans.count()) > 0) {
      await allowedPlans.click()
      const opt = page.getByRole('option', { name: new RegExp(planName, 'i') })
      if ((await opt.count()) > 0) await opt.first().click()
      else await page.getByRole('option').first().click()
    }
  }

  await saveObjectAndWaitForNavigation(page, {
    apiPath: '/api/class-options',
    expectedUrlPattern: /\/admin\/collections\/class-options\/\d+/,
    collectionName: 'class-options',
  })
  const classOptionId = parseIdFromUrl(page.url(), 'class-options')
  if (classOptionId == null) throw new Error('Could not parse class option ID from URL after save')

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const lessonId = await createLessonViaApi(page, {
    classOptionId,
    date: tomorrow,
    startHour: 10,
    startMinute: 0,
    endHour: 11,
    endMinute: 0,
  })

  return { lessonId, tomorrow, className }
}

async function ensureAtLeastOneDropIn(page: Page): Promise<string> {
  await page.goto('/admin/collections/drop-ins', { waitUntil: 'domcontentloaded', timeout: 120000 })
  const rows = page.getByRole('row')
  const rowCount = await rows.count()
  if (rowCount > 1) {
    const firstDataRow = rows.nth(1)
    const firstLink = firstDataRow.getByRole('link').first()
    const linkText = (await firstLink.textContent().catch(() => ''))?.trim()
    if (linkText) return linkText
    return 'Drop In'
  }
  const dropInName = `E2E Drop In ${Date.now()}`
  const createLink = page.getByRole('link', { name: /Create new.*Drop In/i })
  if ((await createLink.count()) > 0) createLink.first().click()
  else await page.getByRole('button', { name: /Create new.*Drop In/i }).click()
  await page.getByRole('textbox', { name: 'Name *' }).waitFor({ state: 'visible', timeout: 20000 })
  await page.getByRole('textbox', { name: 'Name *' }).fill(dropInName)
  const priceInput = page.getByRole('spinbutton', { name: /Price/i })
  if ((await priceInput.count()) > 0) priceInput.fill('15')
  const isActive = page.getByRole('checkbox', { name: /Is Active/i })
  if ((await isActive.count()) > 0) isActive.setChecked(true)
  const paymentMethodsCombobox = page
    .locator('text=Payment Methods')
    .locator('..')
    .locator('[role="combobox"]')
    .first()
  if ((await paymentMethodsCombobox.count()) > 0) {
    await paymentMethodsCombobox.click()
    const cardOption = page.getByRole('option', { name: /card/i })
    if ((await cardOption.count()) > 0) cardOption.first().click()
    else await page.keyboard.press('Escape').catch(() => {})
  }
  await saveObjectAndWaitForNavigation(page, {
    apiPath: '/api/drop-ins',
    expectedUrlPattern: /\/admin\/collections\/drop-ins\/\d+/,
    collectionName: 'drop-ins',
  })
  return dropInName
}

/**
 * Register via complete-booking (magic link), then follow callback.
 * Assumes we're on /complete-booking with callbackUrl set (or pass callbackPath).
 * Returns { email } and navigates to callback (or dashboard).
 */
export async function registerParentAndGetMagicLink(
  page: Page,
  opts: { callbackPath?: string; name?: string; email?: string } = {},
): Promise<{ email: string }> {
  const request = page.context().request as any
  const name = opts.name ?? 'Parent User'
  const email = opts.email ?? `parent-${Date.now()}@example.com`

  let callbackPath = opts.callbackPath
  if (!callbackPath) {
    try {
      const u = new URL(page.url())
      const raw = u.searchParams.get('callbackUrl')
      if (raw) callbackPath = raw.startsWith('http') ? new URL(raw).pathname : raw
    } catch {
      /* ignore */
    }
  }
  if (!callbackPath) callbackPath = '/dashboard'

  const registerTab = page.getByRole('tab', { name: /Register/i })
  if ((await registerTab.count()) > 0) {
    await registerTab.scrollIntoViewIfNeeded().catch(() => {})
    await registerTab.click({ force: true })
  }

  await clearTestMagicLinks(request, email)
  const nameInput = page.getByRole('textbox', { name: /Name/i })
  await expect(nameInput).toBeVisible({ timeout: process.env.CI ? 30000 : 10000 })
  await nameInput.fill(name)
  const emailInput = page.getByRole('textbox', { name: /Email/i })
  await expect(emailInput).toBeVisible({ timeout: 10000 })
  await emailInput.fill(email)

  const submitButton = page.getByRole('button', { name: 'Submit' })
  await expect(submitButton).toBeVisible({ timeout: 10000 })
  await expect(submitButton).toBeEnabled({ timeout: 10000 }).catch(() => page.waitForTimeout(1000))

  const magicLinkSentNav = page.waitForURL(/\/magic-link-sent/, {
    timeout: process.env.CI ? 120000 : 90000,
  })
  await Promise.all([magicLinkSentNav, submitButton.click()])

  await expect(page).toHaveURL(/\/magic-link-sent/)
  const magicLink = await pollForTestMagicLink(request, email, 15, 1000)
  await page.goto(magicLink.url, { waitUntil: 'load', timeout: 60000 })

  const pathToMatch = callbackPath.split('?')[0] ?? callbackPath
  const pathMatch = (url: URL) =>
    url.pathname.startsWith(pathToMatch) ||
    /\/dashboard/.test(url.pathname) ||
    (pathToMatch.startsWith('/bookings/') && /\/bookings\/children\/\d+/.test(url.pathname))
  await page.waitForURL((url) => pathMatch(new URL(url)), { timeout: 60000 }).catch(() => {})

  try {
    const u = new URL(page.url())
    if (!pathMatch(u)) {
      await page.goto(callbackPath, { waitUntil: 'domcontentloaded', timeout: 30000 })
    }
  } catch {
    await page.goto(callbackPath, { waitUntil: 'domcontentloaded', timeout: 30000 })
  }

  return { email }
}
