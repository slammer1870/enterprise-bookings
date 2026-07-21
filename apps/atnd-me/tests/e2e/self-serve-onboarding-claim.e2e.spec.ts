/**
 * E2E: self-serve tenant claim → magic link → admin onboarding checklist.
 *
 * Covers the full happy path plus step progression so checklist unlock order,
 * view-page new tab, password CTA, and default monogram logo do not regress.
 */
import type { APIRequestContext, Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import {
  createTestEventType,
  getPayloadInstance,
  updateTenantStripeConnect,
} from './helpers/data-helpers'
import { emptySchedulerWeekDays } from './helpers/scheduler-e2e-helpers'
import { clearTestMagicLinks, pollForTestMagicLink } from '@repo/testing-config/src/playwright'
import { e2eExpectTimeout, e2eSlowTestTimeout } from './helpers/timeouts'

/** Matches `SKIP_SCHEDULER_GENERATION` in `src/lib/scheduler/constants.ts`. */
const SKIP_SCHEDULER_GENERATION = 'skipSchedulerGeneration'

const TASK_ORDER = ['stripe', 'eventType', 'schedule', 'viewSite', 'password'] as const

async function claimTenantViaApi(
  request: APIRequestContext,
  input: { slug: string; tenantName: string; name: string; email: string },
) {
  const res = await request.post('/api/onboarding/claim', {
    data: input,
    headers: { 'Content-Type': 'application/json' },
  })
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
    code?: string
  }
  return { res, body }
}

async function gotoClaimedAdmin(page: Page, magicLinkUrl: string) {
  await page.goto(magicLinkUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/admin(\/|$|\?)/, { timeout: e2eExpectTimeout(60_000) })
}

async function reloadAdminDashboard(page: Page, slug: string) {
  await page.goto(`http://${slug}.localhost:3000/admin`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => null)
}

test.describe('Self-serve onboarding claim', () => {
  test.setTimeout(e2eSlowTestTimeout(300_000, 240_000))

  test('claim → magic link → checklist progression → monogram logo', async ({
    page,
    request,
    testData,
  }) => {
    const w = testData.workerIndex
    const stamp = Date.now()
    const slug = `claim-e2e-${stamp}-w${w}`.slice(0, 48)
    const email = `claim-e2e-${stamp}-w${w}@example.com`
    const tenantName = `Claim Studio ${stamp}`
    const personName = 'Claim Admin'

    await clearTestMagicLinks(request, email)

    const { res: claimRes, body: claimBody } = await claimTenantViaApi(request, {
      slug,
      tenantName,
      name: personName,
      email,
    })
    expect(claimRes.status(), JSON.stringify(claimBody)).toBe(200)
    expect(claimBody.ok).toBe(true)

    const payload = await getPayloadInstance()
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 1,
      overrideAccess: true,
    })
    const tenant = tenants.docs[0] as {
      id: number
      name?: string
      logo?:
        | number
        | { id?: number; alt?: string | null; filename?: string | null; url?: string | null }
        | null
    }
    expect(tenant?.id).toBeTruthy()
    expect(tenant.name).toBe(tenantName)

    // Default monogram logo from company name
    expect(tenant.logo, 'bootstrap should attach a default tenant logo').toBeTruthy()
    const logo =
      typeof tenant.logo === 'object' && tenant.logo !== null
        ? tenant.logo
        : await payload.findByID({
            collection: 'media',
            id: tenant.logo as number,
            depth: 0,
            overrideAccess: true,
          })
    expect(logo).toBeTruthy()
    expect(String((logo as { alt?: string }).alt || '')).toMatch(/logo/i)
    expect(String((logo as { filename?: string }).filename || '')).toMatch(/-logo\.png$/i)

    const locations = await payload.find({
      collection: 'locations',
      where: { tenant: { equals: tenant.id } },
      limit: 1,
      overrideAccess: true,
    })
    expect(locations.docs.length).toBeGreaterThanOrEqual(1)

    const home = await payload.find({
      collection: 'pages',
      where: {
        and: [{ slug: { equals: 'home' } }, { tenant: { equals: tenant.id } }],
      },
      limit: 1,
      overrideAccess: true,
    })
    expect(home.docs[0]).toBeTruthy()

    const magicLink = await pollForTestMagicLink(request, email, 20, 1000)
    expect(magicLink.url).toMatch(new RegExp(`${slug}\\.localhost`))
    expect(magicLink.url).toMatch(/magic-link\/verify/)
    expect(decodeURIComponent(magicLink.url)).toMatch(new RegExp(`${slug}\\.localhost:3000/admin`))

    await gotoClaimedAdmin(page, magicLink.url)
    await expect(page).toHaveURL(new RegExp(`http://${slug}\\.localhost:3000/admin`))

    const checklist = page.getByTestId('onboarding-checklist')
    await expect(checklist).toBeVisible({ timeout: e2eExpectTimeout(30_000) })
    await expect(checklist.getByText(/get started/i)).toBeVisible()
    await expect(checklist.getByText(/\d\/5 complete/i)).toBeVisible()

    for (const id of TASK_ORDER) {
      await expect(page.getByTestId(`onboarding-task-${id}`)).toBeVisible()
    }

    await expect(page.getByTestId('onboarding-task-stripe')).toHaveAttribute('data-state', 'current')
    await expect(page.getByTestId('onboarding-task-eventType')).toHaveAttribute(
      'data-state',
      'locked',
    )
    await expect(page.getByTestId('onboarding-task-password')).toHaveAttribute(
      'data-state',
      'locked',
    )

    // ── Stripe complete ─────────────────────────────────────────────────────
    await updateTenantStripeConnect(tenant.id, {
      stripeConnectOnboardingStatus: 'active',
      stripeConnectAccountId: `acct_claim_e2e_${stamp}_w${w}`,
    })
    await reloadAdminDashboard(page, slug)
    await expect(page.getByTestId('onboarding-task-stripe')).toHaveAttribute('data-state', 'done', {
      timeout: e2eExpectTimeout(30_000),
    })
    await expect(page.getByTestId('onboarding-task-eventType')).toHaveAttribute(
      'data-state',
      'current',
    )

    // ── Event type complete ─────────────────────────────────────────────────
    const eventType = await createTestEventType(
      tenant.id,
      `Claim E2E Class ${stamp}`,
      10,
      'Claim flow event type',
      w,
    )
    await reloadAdminDashboard(page, slug)
    await expect(page.getByTestId('onboarding-task-eventType')).toHaveAttribute(
      'data-state',
      'done',
      { timeout: e2eExpectTimeout(30_000) },
    )
    await expect(page.getByTestId('onboarding-task-schedule')).toHaveAttribute(
      'data-state',
      'current',
    )

    // ── Schedule complete ───────────────────────────────────────────────────
    const startDate = new Date()
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 28)
    await payload.create({
      collection: 'scheduler',
      data: {
        tenant: tenant.id,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        lockOutTime: 0,
        defaultEventType: eventType.id,
        clearExisting: false,
        week: { days: emptySchedulerWeekDays() },
      },
      overrideAccess: true,
      context: { [SKIP_SCHEDULER_GENERATION]: true },
    })
    await reloadAdminDashboard(page, slug)
    await expect(page.getByTestId('onboarding-task-schedule')).toHaveAttribute(
      'data-state',
      'done',
      { timeout: e2eExpectTimeout(30_000) },
    )
    await expect(page.getByTestId('onboarding-task-viewSite')).toHaveAttribute(
      'data-state',
      'current',
    )

    // ── View your page (new tab) ────────────────────────────────────────────
    const viewTask = page.getByTestId('onboarding-task-viewSite')
    const viewLink = viewTask.getByRole('link', { name: /view your page/i })
    await expect(viewLink).toBeVisible()
    await expect(viewLink).toHaveAttribute('target', '_blank')
    await expect(viewLink).toHaveAttribute('href', new RegExp(`${slug}\\.localhost`))

    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: e2eExpectTimeout(15_000) }),
      viewLink.click(),
    ])
    await popup.waitForLoadState('domcontentloaded').catch(() => null)
    expect(popup.url()).toMatch(new RegExp(`http://${slug}\\.localhost:3000`))
    await popup.close()

    await expect
      .poll(
        async () => {
          await reloadAdminDashboard(page, slug)
          return page.getByTestId('onboarding-task-viewSite').getAttribute('data-state')
        },
        { timeout: e2eExpectTimeout(30_000) },
      )
      .toBe('done')
    await expect(page.getByTestId('onboarding-task-password')).toHaveAttribute(
      'data-state',
      'current',
    )

    // ── Set password (last step) ────────────────────────────────────────────
    const passwordTask = page.getByTestId('onboarding-task-password')
    await passwordTask.getByRole('button', { name: /set password/i }).click()
    await page.waitForURL(/\/admin\/collections\/users\/\d+/, {
      timeout: e2eExpectTimeout(30_000),
    })

    await reloadAdminDashboard(page, slug)
    // All steps done → checklist dismissed
    await expect(page.getByTestId('onboarding-checklist')).toHaveCount(0, {
      timeout: e2eExpectTimeout(30_000),
    })
  })

  test('claim API rejects reserved and duplicate slugs', async ({ request, testData }) => {
    const w = testData.workerIndex
    const stamp = Date.now()
    const email = `claim-reject-${stamp}-w${w}@example.com`

    const reserved = await claimTenantViaApi(request, {
      slug: 'admin',
      tenantName: 'Nope',
      name: 'Nope',
      email: `reserved-${stamp}-w${w}@example.com`,
    })
    expect(reserved.res.status()).toBeGreaterThanOrEqual(400)
    expect(reserved.body.ok).not.toBe(true)

    const slug = `claim-dup-${stamp}-w${w}`.slice(0, 48)
    await clearTestMagicLinks(request, email)
    const first = await claimTenantViaApi(request, {
      slug,
      tenantName: `Dup Studio ${stamp}`,
      name: 'Dup Admin',
      email,
    })
    expect(first.res.status()).toBe(200)

    const dup = await claimTenantViaApi(request, {
      slug,
      tenantName: 'Other',
      name: 'Other',
      email: `other-${stamp}-w${w}@example.com`,
    })
    expect(dup.res.status()).toBe(409)
    expect(dup.body.code === 'slug_taken' || /taken|already/i.test(dup.body.error || '')).toBe(
      true,
    )
  })
})
