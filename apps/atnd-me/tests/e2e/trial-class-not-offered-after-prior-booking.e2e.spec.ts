/**
 * E2E: Trial class is only offered to first-time bookers (no prior confirmed bookings).
 *
 * Verifies:
 * - Schedule CTA is "Book Trial Class" when the viewer has no confirmed bookings and the class
 *   uses a drop-in with a trial discount tier.
 * - After any confirmed booking exists for the viewer, the booking page no longer treats the
 *   lesson as a first-time trial.
 * - On the drop-in payment panel for that lesson, the trial discount copy is not shown.
 */
import { test, expect } from './helpers/fixtures'
import { loginAsRegularUser } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { createTestEventType, createTestTimeslot, getPayloadInstance } from './helpers/data-helpers'

function addDays(start: Date, days: number): Date {
  const next = new Date(start)
  next.setDate(next.getDate() + days)
  return next
}

async function advanceScheduleToDate(page: Parameters<typeof test>[0]['page'], targetDate: Date) {
  const dateLabel = page.locator('p.text-center.text-lg').first()
  await expect(dateLabel).toBeVisible({ timeout: 15_000 })

  const toggle = dateLabel.locator('xpath=..')
  const nextDayButton = toggle.locator('svg').nth(1)
  const targetLabel = targetDate.toDateString()

  for (let i = 0; i < 14; i += 1) {
    const currentLabel = (await dateLabel.textContent())?.trim()
    if (currentLabel === targetLabel) return

    await nextDayButton.click()
    await expect(dateLabel).toHaveText(targetLabel, { timeout: 10_000 }).catch(() => null)
  }

  await expect(dateLabel).toHaveText(targetLabel, { timeout: 15_000 })
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

test.describe('Trial class offer (first-time bookings only)', () => {
  test.describe.configure({ timeout: 120_000 })

  test('booking page stops offering trial after a confirmed booking', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const userId = testData.users.user1.id

    if (!tenantId || !tenantSlug) {
      throw new Error('Tenant ID or slug is missing from test data')
    }

    await payload.delete({
      collection: 'bookings',
      where: {
        and: [{ user: { equals: userId } }, { status: { equals: 'confirmed' } }],
      },
      overrideAccess: true,
    })

    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: `acct_trial_cta_${tenantId}`,
      },
      overrideAccess: true,
    })

    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `E2E Trial CTA Drop-in ${tenantId}-${Date.now()}`,
        isActive: true,
        price: 10,
        adjustable: true,
        paymentMethods: ['card'],
        discountTiers: [{ minQuantity: 1, discountPercent: 50, type: 'trial' }],
        tenant: tenantId,
      },
      overrideAccess: true,
    })) as { id: number }

    const classOption = await createTestEventType(tenantId, 'Trial offer gate', 10)
    await payload.update({
      collection: 'event-types',
      id: classOption.id,
      data: {
        paymentMethods: { allowedDropIn: dropIn.id },
        tenant: tenantId,
      },
      overrideAccess: true,
    })

    const priorEventType = await createTestEventType(tenantId, 'Prior confirmed booking gate', 5)
    const targetDate = addDays(new Date(), 5)
    targetDate.setHours(0, 0, 0, 0)

    const mkTimeslot = async (daysFromNow: number, classOptionId: number) => {
      const start = new Date()
      start.setDate(start.getDate() + daysFromNow)
      start.setHours(12, 0, 0, 0)
      const end = new Date(start)
      end.setHours(13, 0, 0, 0)
      return createTestTimeslot(tenantId, classOptionId, start, end, undefined, true)
    }

    const trialTimeslot = await mkTimeslot(5, classOption.id)
    const priorTimeslot = await mkTimeslot(1, priorEventType.id)

    await new Promise((r) => setTimeout(r, 600))

    await loginAsRegularUser(page, 1, testData.users.user1.email, 'password', { tenantSlug })
    await setPayloadTenantCookie(page, tenantId, tenantSlug)

    const expectClassPrice = async (expected: string) => {
      const row = page.getByText('Price').first().locator('..')
      await expect(row.getByText(expected)).toBeVisible({ timeout: 15_000 })
    }

    const getTrialScheduleRow = () => {
      const lessonTitle = page.getByText(classOption.name, { exact: true }).first()
      return lessonTitle.locator('xpath=ancestor::div[contains(@class,"border-b")]').first()
    }

    await navigateToTenant(page, tenantSlug, '/')
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/home', {
      timeout: 15_000,
    }).catch(() => null)
    await expect(page.getByText(/loading schedule/i)).not.toBeVisible({ timeout: 15_000 }).catch(
      () => null,
    )
    await advanceScheduleToDate(page, targetDate)
    await expect(page.getByText(classOption.name, { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    await expect(getTrialScheduleRow().getByRole('button', { name: /book trial class/i })).toBeVisible({
      timeout: 15_000,
    })

    await navigateToTenant(page, tenantSlug, '/')
    await page.waitForLoadState('domcontentloaded').catch(() => null)
    await navigateToTenant(page, tenantSlug, `/bookings/${trialTimeslot.id}`)
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => null)
    await expect(page.getByText(/payment methods/i).first()).toBeVisible({ timeout: 15_000 })
    await page.getByRole('tab', { name: /drop-?in/i }).click()
    await expect(page.getByText(/Since this is a trial class/i)).toBeVisible({ timeout: 15_000 })
    await expectClassPrice('€5.00')

    await payload.create({
      collection: 'bookings',
      data: {
        user: userId,
        timeslot: priorTimeslot.id,
        tenant: tenantId,
        status: 'confirmed',
      },
      overrideAccess: true,
    })

    await navigateToTenant(page, tenantSlug, '/')
    await page.waitForLoadState('domcontentloaded').catch(() => null)
    await navigateToTenant(page, tenantSlug, `/bookings/${trialTimeslot.id}`)
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => null)
    await expect(page.getByText(/payment methods/i).first()).toBeVisible({ timeout: 15_000 })
    await page.getByRole('tab', { name: /drop-?in/i }).click()
    await expect(page.getByText(/Since this is a trial class/i)).not.toBeVisible({ timeout: 15_000 })
    await expectClassPrice('€10.00')
    await expect(page.getByText('€5.00').first()).not.toBeVisible()
  })
})
