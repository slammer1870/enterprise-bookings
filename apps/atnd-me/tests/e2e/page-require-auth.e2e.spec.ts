/**
 * E2E: CMS `requireAuth` on pages — anonymous visitors redirect to sign-in; signed-in users see content.
 */
import { test, expect } from './helpers/fixtures'
import { createTestPage } from './helpers/data-helpers'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'

test.describe('Page requireAuth (CMS)', () => {
  test('anonymous visitor is redirected to sign-in with redirectTo to the page', async ({
    page,
    testData,
  }) => {
    const tenant = testData.tenants[0]!
    const slug = `e2e-req-auth-${testData.workerIndex}-${Date.now()}`
    const visibleTitle = `E2E protected ${slug}`

    await createTestPage(tenant.id, slug, 'E2E protected page', {
      requireAuth: true,
      layout: [
        {
          blockType: 'heroSchedule',
          blockName: 'E2E',
          title: visibleTitle,
        },
      ],
    })

    const origin = `http://${tenant.slug}.localhost:3000`
    await page.goto(`${origin}/${slug}`, { waitUntil: 'domcontentloaded' })

    await expect(page).toHaveURL(/\/auth\/sign-in/, { timeout: 20_000 })

    const url = new URL(page.url())
    expect(url.pathname).toContain('/auth/sign-in')
    const rawRedirect = url.searchParams.get('redirectTo')
    expect(rawRedirect, 'redirectTo should be present').toBeTruthy()
    expect(decodeURIComponent(rawRedirect!)).toContain(`/${slug}`)
  })

  test('signed-in user can view the protected page', async ({ page, testData }) => {
    const tenant = testData.tenants[0]!
    const slug = `e2e-req-auth-in-${testData.workerIndex}-${Date.now()}`
    const visibleTitle = `E2E protected signed-in ${slug}`

    await createTestPage(tenant.id, slug, 'E2E protected page (signed-in)', {
      requireAuth: true,
      layout: [
        {
          blockType: 'heroSchedule',
          blockName: 'E2E',
          title: visibleTitle,
        },
      ],
    })

    const origin = `http://${tenant.slug}.localhost:3000`

    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password', {
      baseURL: origin,
      tenantSlug: tenant.slug,
    })

    await page.goto(`${origin}/${slug}`, { waitUntil: 'domcontentloaded' })

    await expect(page).not.toHaveURL(/\/auth\/sign-in/, { timeout: 5000 })
    await expect(page.getByText(visibleTitle, { exact: true })).toBeVisible({ timeout: 20_000 })
  })

  test('public page on same tenant does not require sign-in', async ({ page, testData }) => {
    const tenant = testData.tenants[0]!
    const origin = `http://${tenant.slug}.localhost:3000`

    await page.goto(`${origin}/home`, { waitUntil: 'domcontentloaded' })

    await expect(page).not.toHaveURL(/\/auth\/sign-in/, { timeout: 15_000 })
  })
})
