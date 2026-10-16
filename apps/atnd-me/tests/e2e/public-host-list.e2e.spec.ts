import type { Browser, Page } from '@playwright/test'
import { loginAsSuperAdmin, loginAsTenantAdmin } from './helpers/auth-helpers'
import { createTestTenant, createTestUser, getPayloadInstance } from './helpers/data-helpers'
import { e2eExpectTimeout, e2eSlowTestTimeout } from './helpers/timeouts'
import { test, expect } from './helpers/fixtures'

const PUBLIC_HOST_COLUMNS = {
  'Public host': 'host',
  Role: 'role',
  Type: 'type',
  'DNS host': 'dnsHost',
  Value: 'value',
  'DNS status': 'dnsStatus',
  'Certificate status': 'certificateStatus',
} as const

type PublicHostColumn = (typeof PUBLIC_HOST_COLUMNS)[keyof typeof PUBLIC_HOST_COLUMNS]

type PublicHostCells = Record<PublicHostColumn, string>

function emptyPublicHostCells(): PublicHostCells {
  return { host: '', role: '', type: '', dnsHost: '', value: '', dnsStatus: '', certificateStatus: '' }
}

async function publicHostCells(page: Page): Promise<PublicHostCells[]> {
  const table = page.getByRole('table', { name: 'Public hosts' })
  await expect(table).toBeVisible({ timeout: e2eExpectTimeout(45_000) })
  const headings = (await table.locator('thead th').allInnerTexts()).map((text) => text.replace(/\s+/g, ' ').trim())
  const rows = table.locator('tbody tr')
  const count = await rows.count()
  const cells: PublicHostCells[] = []
  for (let i = 0; i < count; i++) {
    const rowCells = rows.nth(i).locator('td')
    const width = await rowCells.count()
    const record = emptyPublicHostCells()
    for (let j = 0; j < width; j++) {
      const heading = headings[j]
      const column = heading ? PUBLIC_HOST_COLUMNS[heading as keyof typeof PUBLIC_HOST_COLUMNS] : undefined
      if (!column) throw new Error(`Unexpected public host column: ${heading ?? String(j)}`)
      record[column] = (await rowCells.nth(j).innerText()).replace(/\s+/g, ' ').trim()
    }
    cells.push(record)
  }
  return cells
}

async function assignOrgAdmin(email: string, tenantId: number): Promise<void> {
  const payload = await getPayloadInstance()
  await payload.update({
    collection: 'users',
    where: { email: { equals: email } },
    data: {
      tenants: [{ tenant: tenantId, roles: ['admin'] }],
      registrationTenant: tenantId,
    },
    overrideAccess: true,
  })
}

async function openTenantHosts(page: Page, tenantId: number): Promise<PublicHostCells[]> {
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
): Promise<PublicHostCells[]> {
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
    await assignOrgAdmin(orgAdmin.email, tenant.id)

    const rows = await rowsSeenByBothRoles(
      browser,
      orgAdmin.email,
      testData.users.superAdmin.email,
      Number(tenant.id),
      slug,
    )

    expect(rows).toEqual([
      {
        host: canonical,
        role: 'canonical',
        type: 'CNAME',
        dnsHost: 'blog.shop',
        value: 'cname.localhost',
        dnsStatus: 'Unknown',
        certificateStatus: 'Unknown',
      },
      {
        host: alias,
        role: 'alias',
        type: 'CNAME',
        dnsHost: 'www',
        value: 'cname.localhost',
        dnsStatus: 'Unknown',
        certificateStatus: 'Unknown',
      },
      {
        host: `${slug}.localhost`,
        role: 'alias',
        type: '',
        dnsHost: '',
        value: '',
        dnsStatus: '',
        certificateStatus: '',
      },
    ])
    expect(rows.map((row) => row.type)).not.toContain('TXT')
    expect(rows.map((row) => row.type)).not.toContain('A')
    expect(rows.map((row) => row.type)).not.toContain('AAAA')
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
    await assignOrgAdmin(orgAdmin.email, tenant.id)

    const rows = await rowsSeenByBothRoles(
      browser,
      orgAdmin.email,
      testData.users.superAdmin.email,
      Number(tenant.id),
      slug,
    )

    expect(rows).toEqual([
      {
        host: canonical,
        role: 'canonical',
        type: 'CNAME',
        dnsHost: '@',
        value: 'cname.localhost',
        dnsStatus: 'Unknown',
        certificateStatus: 'Unknown',
      },
      {
        host: '',
        role: '',
        type: 'A',
        dnsHost: '@',
        value: '192.0.2.10',
        dnsStatus: '',
        certificateStatus: '',
      },
      {
        host: '',
        role: '',
        type: 'AAAA',
        dnsHost: '@',
        value: '2001:db8::10',
        dnsStatus: '',
        certificateStatus: '',
      },
      {
        host: `${slug}.localhost`,
        role: 'alias',
        type: '',
        dnsHost: '',
        value: '',
        dnsStatus: '',
        certificateStatus: '',
      },
    ])
    expect(rows.map((row) => row.type)).not.toContain('TXT')
  })
})
