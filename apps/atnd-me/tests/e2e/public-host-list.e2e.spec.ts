import type { Browser, Page } from '@playwright/test'
import { loginAsSuperAdmin, loginAsTenantAdmin } from './helpers/auth-helpers'
import { createTestTenant, createTestUser, getPayloadInstance } from './helpers/data-helpers'
import { e2eExpectTimeout, e2eSlowTestTimeout } from './helpers/timeouts'
import { test, expect } from './helpers/fixtures'

async function publicHostCells(page: Page): Promise<string[][]> {
  const table = page.getByRole('table', { name: 'Public hosts' })
  await expect(table).toBeVisible({ timeout: e2eExpectTimeout(45_000) })
  const rows = table.locator('tbody tr')
  const count = await rows.count()
  const cells: string[][] = []
  for (let i = 0; i < count; i++) {
    const rowCells = rows.nth(i).locator('td')
    const width = await rowCells.count()
    const texts: string[] = []
    for (let j = 0; j < width; j++) {
      texts.push((await rowCells.nth(j).innerText()).replace(/\s+/g, ' ').trim())
    }
    cells.push(texts)
  }
  return cells
}

async function openTenantHosts(page: Page, tenantId: number): Promise<string[][]> {
  const origin = new URL(page.url()).origin
  await page.goto(`${origin}/admin/collections/tenants/${tenantId}`, { waitUntil: 'domcontentloaded' })
  return publicHostCells(page)
}

async function rowsSeenByBothRoles(
  browser: Browser,
  orgEmail: string,
  superEmail: string,
  tenantId: number,
  tenantSlug: string,
): Promise<string[][]> {
  const orgContext = await browser.newContext()
  const orgPage = await orgContext.newPage()
  await loginAsTenantAdmin(orgPage, 1, orgEmail, { request: orgPage.request, tenantSlug })
  const orgRows = await openTenantHosts(orgPage, tenantId)
  await orgContext.close()

  const superContext = await browser.newContext()
  const superPage = await superContext.newPage()
  await loginAsSuperAdmin(superPage, superEmail, { request: superPage.request })
  const superRows = await openTenantHosts(superPage, tenantId)
  await superContext.close()

  expect(orgRows).toEqual(superRows)
  return orgRows
}

test.describe('public host list in admin', () => {
  test.setTimeout(e2eSlowTestTimeout(180_000, 120_000))

  test('an org admin and a platform super-admin see the same labeled host list, without TXT or Apex Proxying rows', async ({
    browser,
    testData,
  }) => {
    const stamp = `${testData.workerIndex}${Date.now()}`
    const slug = `phost${stamp}`
    const apex = `ph${stamp}.com`
    const canonical = `blog.shop.${apex}`
    const alias = `www.${apex}`
    const tenant = await createTestTenant(`Public hosts ${stamp}`, slug, canonical)
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: { aliasHosts: [alias] },
      overrideAccess: true,
    })

    const orgAdmin = await createTestUser(
      `publichostsadmin${stamp}@test.com`,
      'password',
      'Public hosts org admin',
      ['admin'],
      tenant.id,
    )
    await payload.update({
      collection: 'users',
      where: { email: { equals: orgAdmin.email } },
      data: {
        tenants: [{ tenant: tenant.id, roles: ['admin'] }],
        registrationTenant: tenant.id,
      } as Parameters<typeof payload.update>[0]['data'],
      overrideAccess: true,
    })

    const rows = await rowsSeenByBothRoles(
      browser,
      orgAdmin.email,
      testData.users.superAdmin.email,
      Number(tenant.id),
      slug,
    )

    expect(rows).toEqual([
      [canonical, 'canonical', 'CNAME', 'blog.shop', 'cname.localhost', 'Unknown', 'Unknown'],
      [alias, 'alias', 'CNAME', 'www', 'cname.localhost', 'Unknown', 'Unknown'],
      [`${slug}.localhost`, 'alias', '', '', '', '', ''],
    ])
    expect(rows.map((row) => row[2])).not.toContain('TXT')
    expect(rows.map((row) => row[2])).not.toContain('A')
    expect(rows.map((row) => row[2])).not.toContain('AAAA')
  })

  test('an apex shows Apex Proxying rows and no TXT to both roles', async ({ browser, testData }) => {
    const stamp = `${testData.workerIndex}${Date.now()}`
    const slug = `phapex${stamp}`
    const canonical = `ph${stamp}.com`
    const tenant = await createTestTenant(`Public hosts apex ${stamp}`, slug, canonical)
    const orgAdmin = await createTestUser(
      `publichostsapex${stamp}@test.com`,
      'password',
      'Public hosts apex org admin',
      ['admin'],
      tenant.id,
    )
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'users',
      where: { email: { equals: orgAdmin.email } },
      data: {
        tenants: [{ tenant: tenant.id, roles: ['admin'] }],
        registrationTenant: tenant.id,
      } as Parameters<typeof payload.update>[0]['data'],
      overrideAccess: true,
    })

    const rows = await rowsSeenByBothRoles(
      browser,
      orgAdmin.email,
      testData.users.superAdmin.email,
      Number(tenant.id),
      slug,
    )

    expect(rows).toEqual([
      [canonical, 'canonical', 'CNAME', '@', 'cname.localhost', 'Unknown', 'Unknown'],
      ['', '', 'A', '@', '192.0.2.10', '', ''],
      ['', '', 'AAAA', '@', '2001:db8::10', '', ''],
      [`${slug}.localhost`, 'alias', '', '', '', '', ''],
    ])
    expect(rows.map((row) => row[2])).not.toContain('TXT')
  })
})
