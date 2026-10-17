import type { Browser, Page } from '@playwright/test'
import { loginAsSuperAdmin, loginAsTenantAdmin } from './helpers/auth-helpers'
import { createTestTenant, createTestUser, getPayloadInstance } from './helpers/data-helpers'
import { e2eExpectTimeout, e2eSlowTestTimeout, e2eTestTimeout } from './helpers/timeouts'
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
  await page.goto(`${origin}/admin/collections/tenants/${tenantId}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  })
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
    const tenant = await createTestTenant(`Public hosts ${stamp}`, slug)
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: { hostnames: [canonical, alias], direction: 'allow-www-and-non-www' },
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
        role: 'serving',
        type: 'CNAME',
        dnsHost: 'www',
        value: 'cname.localhost',
        dnsStatus: 'Unknown',
        certificateStatus: 'Unknown',
      },
      {
        host: `${slug}.localhost`,
        role: `alias to ${canonical}`,
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
        role: `alias to ${canonical}`,
        type: '',
        dnsHost: '',
        value: '',
        dnsStatus: '',
        certificateStatus: '',
      },
    ])
    expect(rows.map((row) => row.type)).not.toContain('TXT')
  })

  test('an org admin and a platform super-admin see saved hostnames in typed order with their roles', async ({
    browser,
    testData,
  }) => {
    const stamp = `${testData.workerIndex}${Date.now()}`
    const slug = `phlist${stamp}`
    const apex = `phlist${stamp}.com`
    const www = `www.${apex}`
    const tenant = await createTestTenant(`Public hosts list ${stamp}`, slug, apex)
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: { hostnames: [www, apex], direction: 'allow-www-and-non-www' },
      overrideAccess: true,
    })

    const orgAdmin = await createTestUser(
      `publichostslist${stamp}@test.com`,
      'password',
      'Public hosts list org admin',
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
        host: www,
        role: 'serving',
        type: 'CNAME',
        dnsHost: 'www',
        value: 'cname.localhost',
        dnsStatus: 'Unknown',
        certificateStatus: 'Unknown',
      },
      {
        host: apex,
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
        role: `alias to ${apex}`,
        type: '',
        dnsHost: '',
        value: '',
        dnsStatus: '',
        certificateStatus: '',
      },
    ])
  })

  test('a Direction the list no longer supports stays selected and the save is refused', async ({
    browser,
    testData,
  }) => {
    test.setTimeout(e2eTestTimeout(180_000))
    const stamp = `${testData.workerIndex}${Date.now()}`
    const slug = `phdir${stamp}`
    const apex = `phdir${stamp}.com`
    const www = `www.${apex}`
    const tenant = await createTestTenant(`Public hosts direction ${stamp}`, slug, apex)
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: { hostnames: [www, apex], direction: 'redirect-to-non-www' },
      overrideAccess: true,
    })

    const orgAdmin = await createTestUser(
      `publichostsdir${stamp}@test.com`,
      'password',
      'Public hosts direction org admin',
      ['admin'],
      tenant.id,
    )
    await assignOrgAdmin(orgAdmin.email, tenant.id)

    const refuseSave = async (page: Page) => {
      const origin = new URL(page.url()).origin
      await page.goto(`${origin}/admin/collections/tenants/${tenant.id}`, {
        waitUntil: 'domcontentloaded',
        timeout: e2eExpectTimeout(90_000),
      })
      const hostnames = page.getByRole('textbox', { name: 'Hostnames' })
      await expect(hostnames).toHaveValue(`${www}, ${apex}`, { timeout: e2eExpectTimeout(45_000) })
      await expect(page.locator('#field-domain')).toHaveCount(0)
      await expect(page.locator('#field-aliasHosts')).toHaveCount(0)
      await expect(page.locator('#field-redirectApex')).toHaveCount(0)
      await expect(page.getByText('Custom domain for this tenant')).toHaveCount(0)
      await expect(page.getByText('Redirect the bare apex domain')).toHaveCount(0)

      const redirectNonWww = page.getByRole('radio', { name: 'Redirect to non-www' })
      const redirectWww = page.getByRole('radio', { name: 'Redirect to www' })
      const allow = page.getByRole('radio', { name: 'Allow www and non-www' })
      const table = page.getByRole('table', { name: 'Public hosts' })
      const email = page.getByTestId('email-domain-dns-instructions')
      await expect(redirectNonWww).toBeChecked()
      await expect(redirectWww).toBeVisible()
      await expect(allow).toBeVisible()
      await expect(table).toBeVisible()
      await expect(email).toBeVisible()

      const hostBox = await hostnames.boundingBox()
      const directionBox = await redirectNonWww.boundingBox()
      const tableBox = await table.boundingBox()
      const emailBox = await email.boundingBox()
      expect(hostBox && directionBox && hostBox.y < directionBox.y).toBe(true)
      expect(directionBox && tableBox && directionBox.y < tableBox.y).toBe(true)
      expect(tableBox && emailBox && tableBox.y < emailBox.y).toBe(true)

      // The field is painted before the admin form attaches it. Typing before that does not update the form.
      await expect
        .poll(
          () =>
            hostnames.evaluate((node) =>
              Object.keys(node).some((key) => key.startsWith('__react')),
            ),
          { timeout: e2eExpectTimeout(45_000) },
        )
        .toBe(true)

      const locked = page.getByRole('dialog', { name: 'document-locked' })
      if (await locked.isVisible()) {
        await locked.getByRole('button', { name: 'Take over' }).click()
        await expect(locked).toBeHidden()
      }
      await expect(hostnames).toBeEditable()

      await hostnames.fill(www)
      await expect(redirectNonWww).toBeChecked()
      await expect(redirectNonWww).toBeDisabled()
      await expect(redirectWww).toBeEnabled()
      const refused = page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' && response.url().includes(`/api/tenants/${tenant.id}`),
        { timeout: 60_000 },
      )
      await page.locator('#action-save').click()
      const save = await refused
      expect(save.status(), await save.text()).toBe(400)
      await expect(page.getByText(`Redirect to non-www needs ${apex} in the hostname list.`)).toBeVisible()
      await expect(redirectNonWww).toBeChecked()
    }

    const orgContext = await browser.newContext()
    const orgPage = await orgContext.newPage()
    await loginAsTenantAdmin(orgPage, 1, orgAdmin.email, { request: orgPage.request, tenantSlug: slug })
    await refuseSave(orgPage)
    await orgContext.close()

    const superContext = await browser.newContext()
    const superPage = await superContext.newPage()
    await loginAsSuperAdmin(superPage, testData.users.superAdmin.email, { request: superPage.request })
    await refuseSave(superPage)
    await superContext.close()

    const stored = await payload.findByID({
      collection: 'tenants',
      id: tenant.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(stored.hostnames).toEqual([www, apex])
    expect(stored.direction).toBe('redirect-to-non-www')
  })

  test('a port or path in the hostname field is refused and the stored list stays', async ({
    browser,
    testData,
  }) => {
    test.setTimeout(e2eTestTimeout(180_000))
    const stamp = `${testData.workerIndex}${Date.now()}`
    const slug = `phraw${stamp}`
    const apex = `phraw${stamp}.com`
    const tenant = await createTestTenant(`Public hosts raw ${stamp}`, slug, apex)
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: { hostnames: [apex], direction: 'allow-www-and-non-www' },
      overrideAccess: true,
    })

    const orgAdmin = await createTestUser(
      `publichostsraw${stamp}@test.com`,
      'password',
      'Public hosts raw org admin',
      ['admin'],
      tenant.id,
    )
    await assignOrgAdmin(orgAdmin.email, tenant.id)

    const context = await browser.newContext()
    const page = await context.newPage()
    await loginAsTenantAdmin(page, 1, orgAdmin.email, { request: page.request, tenantSlug: slug })
    const origin = new URL(page.url()).origin
    await page.goto(`${origin}/admin/collections/tenants/${tenant.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: e2eExpectTimeout(90_000),
    })
    const hostnames = page.getByRole('textbox', { name: 'Hostnames' })
    await expect(hostnames).toHaveValue(apex, { timeout: e2eExpectTimeout(45_000) })
    await expect
      .poll(
        () => hostnames.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__react'))),
        { timeout: e2eExpectTimeout(45_000) },
      )
      .toBe(true)

    const locked = page.getByRole('dialog', { name: 'document-locked' })
    if (await locked.isVisible()) {
      await locked.getByRole('button', { name: 'Take over' }).click()
      await expect(locked).toBeHidden()
    }
    await expect(hostnames).toBeEditable()

    const refuseTyped = async (typed: string, message: string) => {
      await hostnames.fill(typed)
      const refused = page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' && response.url().includes(`/api/tenants/${tenant.id}`),
        { timeout: 60_000 },
      )
      await page.locator('#action-save').click()
      expect((await refused).status()).toBe(400)
      await expect(page.getByText(message)).toBeVisible()
    }

    await refuseTyped(`${apex}:443`, 'Hostname must not include a port.')
    await refuseTyped(`${apex}/kids`, 'without protocol or path')
    await context.close()

    const stored = await payload.findByID({
      collection: 'tenants',
      id: tenant.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(stored.hostnames).toEqual([apex])
    expect(stored.direction).toBe('allow-www-and-non-www')
  })
})
