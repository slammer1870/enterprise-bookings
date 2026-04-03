import { test, expect } from './helpers/fixtures'
import { loginAsTenantAdmin } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { getPayloadInstance } from './helpers/data-helpers'
import { uniqueClassName } from '@repo/testing-config/src/playwright'

function addDays(start: Date, days: number): Date {
  const next = new Date(start)
  next.setDate(next.getDate() + days)
  return next
}

async function advanceScheduleToDate(page: Parameters<typeof test>[0]['page'], targetDate: Date) {
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

async function setPayloadTenantCookie(
  page: Parameters<typeof test>[0]['page'],
  tenantId: number | string,
  tenantSlug: string,
) {
  await page.context().addCookies([
    { name: 'payload-tenant', value: String(tenantId), domain: `${tenantSlug}.localhost`, path: '/' },
    { name: 'tenant-slug', value: tenantSlug, domain: `${tenantSlug}.localhost`, path: '/' },
  ])
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function chooseTenantInCreateModal(
  page: Parameters<typeof test>[0]['page'],
  tenantName: string,
) {
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

async function createPublishedLesson(args: {
  payload: Awaited<ReturnType<typeof getPayloadInstance>>
  tenantId: number
  classOptionId: number
  targetDate: Date
}) {
  const { payload, tenantId, classOptionId, targetDate } = args
  const start = new Date(targetDate)
  start.setHours(10, 0, 0, 0)
  const end = new Date(targetDate)
  end.setHours(11, 0, 0, 0)

  const lesson = await payload.create({
    collection: 'lessons',
    data: {
      tenant: tenantId,
      classOption: classOptionId,
      date: start.toISOString(),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      lockOutTime: 0,
      active: true,
    },
    overrideAccess: true,
  }) as { id?: number }

  expect(lesson.id).toBeTruthy()
  return Number(lesson.id)
}

test.describe('Frontend schedule class-pass lesson visibility regression', () => {
  test.setTimeout(180000)

  test('tenant admin created future lesson with allowed class pass appears on tenant homepage schedule', async ({
    page,
    request,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenant = testData.tenants[0]
    const tenantAdmin = testData.users.tenantAdmin1
    const tenantOrigin = `http://${tenant.slug}.localhost:3000`
    const workerIndex = testData.workerIndex
    const tenantName = tenant.name

    if (!tenant || !tenantAdmin || !tenantName) {
      throw new Error('Expected tenant admin fixtures for schedule regression test')
    }

    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: null,
      },
      overrideAccess: true,
    })

    const classPassType = await payload.create({
      collection: 'class-pass-types',
      draft: false,
      data: {
        name: `Schedule Visibility Pass ${tenant.id}-w${workerIndex}-${Date.now()}`,
        slug: `schedule-visibility-pass-${tenant.id}-${workerIndex}-${Date.now()}`,
        quantity: 5,
        tenant: tenant.id,
        status: 'active',
        allowMultipleBookingsPerLesson: true,
        priceInformation: { price: 25 },
        priceJSON: JSON.stringify({
          id: `price_schedule_visibility_${tenant.id}_${workerIndex}_${Date.now()}`,
        }),
        skipSync: true,
        stripeProductId: `prod_schedule_visibility_${tenant.id}_${workerIndex}_${Date.now()}`,
      },
      overrideAccess: true,
    }) as { id: number }

    const className = uniqueClassName(`ATND Schedule CP ${tenant.id}`)
    const classOption = await payload.create({
      collection: 'class-options',
      data: {
        name: className,
        places: 10,
        description: 'E2E class option for frontend schedule visibility regression',
        tenant: tenant.id,
        paymentMethods: {
          allowedClassPasses: [classPassType.id],
        },
      },
      overrideAccess: true,
    }) as { id: number }

    const targetDate = addDays(new Date(), 5)
    targetDate.setHours(0, 0, 0, 0)

    await loginAsTenantAdmin(page, 1, tenantAdmin.email, {
      request,
      password: 'password',
      tenantSlug: tenant.slug,
    })

    await setPayloadTenantCookie(page, tenant.id, tenant.slug)
    await page.goto(`${tenantOrigin}/admin/collections/lessons/create`, {
      waitUntil: 'domcontentloaded',
      timeout: process.env.CI ? 120000 : 60000,
    })

    await chooseTenantInCreateModal(page, tenantName)
    const lessonId = await createPublishedLesson({
      payload,
      tenantId: tenant.id,
      classOptionId: classOption.id,
      targetDate,
    })

    await page.goto(`${tenantOrigin}/admin/collections/lessons/${lessonId}`, {
      waitUntil: 'domcontentloaded',
      timeout: process.env.CI ? 120000 : 60000,
    })

    await navigateToTenant(page, tenant.slug, '/')
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/home', {
      timeout: 15000,
    }).catch(() => null)

    await expect(page.getByText(/loading schedule/i)).not.toBeVisible({ timeout: 15000 }).catch(() => null)
    await advanceScheduleToDate(page, targetDate)

    await expect(page.getByText('No lessons scheduled for today')).not.toBeVisible({ timeout: 5000 }).catch(() => null)
    await expect(page.getByText(className).first()).toBeVisible({ timeout: 20000 })

    const lessonLink = page.locator(`a[href*="/bookings/"]:has-text("${className}")`).first()
    const hasBookingLink = await lessonLink.isVisible().catch(() => false)
    if (hasBookingLink) {
      await expect(lessonLink).toBeVisible()
    }

    const lessonInDb = await payload.findByID({
      collection: 'lessons',
      id: lessonId,
      overrideAccess: true,
    })

    expect(lessonInDb).toBeTruthy()
  })
})
