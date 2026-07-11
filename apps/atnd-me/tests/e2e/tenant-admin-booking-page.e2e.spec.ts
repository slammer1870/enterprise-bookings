/**
 * Regression: tenant admins who use the Payload admin panel (payload-tenant / payload-location
 * cookies) must still reach /bookings/[id] from the public schedule when the timeslot is in
 * another branch. Previously getByIdForBooking returned NOT_FOUND and createBookingPage
 * redirected to / → /home.
 */
import { test, expect } from './helpers/fixtures'
import { loginAsTenantAdmin } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  getPayloadInstance,
  updateTenantStripeConnect,
} from './helpers/data-helpers'
import { uniqueClassName } from '@repo/testing-config/src/playwright'
import { advanceScheduleToDate } from './helpers/schedule-helpers'
import { e2eSlowTestTimeout } from './helpers/timeouts'

function tenantOrigin(slug: string): string {
  return `http://${slug}.localhost:3000`
}

function futureDate(daysFromNow: number, hour = 10): Date {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, 0, 0, 0)
  return d
}

async function getLessonBookButton(page: Parameters<typeof advanceScheduleToDate>[0], scheduleTitle: string) {
  const lessonTitles = page.getByText(scheduleTitle, { exact: true })
  await expect(lessonTitles.first()).toBeVisible({ timeout: 20000 })

  const count = await lessonTitles.count()
  for (let i = 0; i < count; i++) {
    const lessonRow = lessonTitles.nth(i).locator('xpath=ancestor::div[contains(@class,"border-b")]').first()
    const btn = lessonRow.getByRole('button', { name: /^book$/i })
    if ((await btn.count()) > 0) {
      return btn
    }
  }

  const lessonRow = lessonTitles.first().locator('xpath=ancestor::div[contains(@class,"border-b")]').first()
  return lessonRow.getByRole('button', { name: /^book$/i })
}

test.describe('Tenant admin public booking page', () => {
  test.setTimeout(e2eSlowTestTimeout())

  test('tenant admin with admin branch cookie can open booking page for a timeslot in another branch', async ({
    page,
    request,
    testData,
  }) => {
    const tenant = testData.tenants[0]!
    const tenantAdmin = testData.users.tenantAdmin1
    const w = testData.workerIndex

    if (!tenant?.id || !tenant?.slug || !tenantAdmin?.email) {
      throw new Error('Expected tenant and tenant admin fixtures')
    }

    const payload = await getPayloadInstance()
    const slugSuffix = w > 0 ? `-w${w}` : ''
    const origin = tenantOrigin(tenant.slug)

    const findOrCreateLocation = async (slug: string, name: string) => {
      const existing = await payload.find({
        collection: 'locations',
        where: { and: [{ slug: { equals: slug } }, { tenant: { equals: tenant.id } }] },
        limit: 1,
        overrideAccess: true,
      })
      if (existing.docs[0]) {
        const doc = existing.docs[0]
        if (!doc.active) {
          return payload.update({
            collection: 'locations',
            id: doc.id as number,
            data: { name, slug, tenant: tenant.id, active: true },
            overrideAccess: true,
          })
        }
        return doc
      }
      return payload.create({
        collection: 'locations',
        data: { name, slug, tenant: tenant.id, active: true },
        overrideAccess: true,
      })
    }

    const locA = await findOrCreateLocation(`e2e-ta-book-br-a${slugSuffix}`, `E2E TA Book Branch A${slugSuffix}`)
    const locB = await findOrCreateLocation(`e2e-ta-book-br-b${slugSuffix}`, `E2E TA Book Branch B${slugSuffix}`)

    // Hide unrelated active locations so the schedule picker only shows our two branches.
    await payload.update({
      collection: 'locations',
      where: {
        and: [
          { tenant: { equals: tenant.id } },
          { active: { equals: true } },
          { id: { not_in: [locA.id as number, locB.id as number] } },
        ],
      },
      data: { active: false },
      overrideAccess: true,
    })

    await updateTenantStripeConnect(tenant.id, {
      stripeConnectOnboardingStatus: 'active',
      stripeConnectAccountId: `acct_e2e_ta_book_${w}`,
    })

    const className = uniqueClassName(`E2E Tenant Admin Booking ${tenant.id}`)
    const eventType = await createTestEventType(tenant.id, className, 10, 'Tenant admin booking regression', w)

    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `E2E TA Book Drop-in ${tenant.id}-w${w}-${Date.now()}`,
        isActive: true,
        price: 15,
        adjustable: false,
        maxBookingsPerTimeslot: 1,
        tenant: tenant.id,
      },
      overrideAccess: true,
    })) as { id: number }

    await payload.update({
      collection: 'event-types',
      id: eventType.id,
      data: {
        paymentMethods: { allowedDropIn: dropIn.id },
        tenant: tenant.id,
      },
      overrideAccess: true,
    })

    const startTime = futureDate(14 + w)
    const endTime = futureDate(14 + w, 11)
    const lesson = await createTestTimeslot(
      tenant.id,
      eventType.id,
      startTime,
      endTime,
      undefined,
      true,
      locB.id as number,
    )

    await loginAsTenantAdmin(page, 1, tenantAdmin.email, {
      request,
      tenantSlug: tenant.slug,
    })

    // Mimic admin panel branch selection: cookie scopes reads to branch A only.
    await page.context().addCookies([
      { name: 'payload-tenant', value: String(tenant.id), url: `${origin}/` },
      { name: 'payload-tenant', value: String(tenant.id), url: `${origin}/admin/` },
      { name: 'payload-location', value: String(locA.id), url: `${origin}/` },
      { name: 'payload-location', value: String(locA.id), url: `${origin}/admin/` },
    ])

    await navigateToTenant(page, tenant.slug, '/')
    await page
      .waitForURL((url) => url.pathname === '/' || url.pathname === '/home', { timeout: 15000 })
      .catch(() => null)
    await expect(page.getByText(/loading schedule/i)).not.toBeVisible({ timeout: 15000 }).catch(() => null)

    // Timeslot lives in branch B; switch the public schedule picker away from the default branch.
    const locationPicker = page.getByText('Show schedule for').locator('xpath=..')
    await expect(locationPicker).toBeVisible({ timeout: 20000 })
    const branchCombobox = locationPicker.getByRole('combobox')
    await locationPicker.scrollIntoViewIfNeeded()
    await branchCombobox.evaluate((el) => (el as HTMLButtonElement).click())
    await page.getByRole('option', { name: locB.name as string }).click()
    await expect(page.getByText(/loading schedule/i)).not.toBeVisible({ timeout: 15000 }).catch(() => null)

    await advanceScheduleToDate(page, startTime)

    const scheduleTitle = `${className} ${tenant.id}${w > 0 ? ` w${w}` : ''}`
    const bookBtn = await getLessonBookButton(page, scheduleTitle)
    await expect(bookBtn).toBeVisible({ timeout: 10000 })

    const trpcCall = page.waitForResponse(
      (r) =>
        r.url().includes('bookSingleSlotTimeslotOrRedirect') &&
        r.request().method() === 'POST' &&
        r.status() === 200,
      { timeout: 20000 },
    )
    await Promise.all([trpcCall, bookBtn.click()])

    await page.waitForURL((url) => url.pathname === `/bookings/${lesson.id}`, { timeout: 20000 })
    expect(page.url()).not.toMatch(/\/home\/?$/)
    await expect(
      page.getByText(/select quantity|payment methods|choose how to pay/i).first(),
    ).toBeVisible({ timeout: 15000 })
  })
})
