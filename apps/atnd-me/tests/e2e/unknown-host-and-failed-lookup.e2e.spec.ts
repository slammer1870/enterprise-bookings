/**
 * E2E: unknown hosts and failed host lookups answer without the platform mark.
 *
 * Run from monorepo root:
 *   pnpm test:e2e:atnd-me -- unknown-host-and-failed-lookup
 */
import type { APIResponse } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { createTestPage, createTestTenant } from './helpers/data-helpers'
import { isNipIoDnsAvailable } from './helpers/dns-helpers'
import { e2eSlowTestTimeout } from './helpers/timeouts'
import { E2E_FORCE_HOST_LOOKUP_FAILURE_HEADER } from '../../src/utilities/publicHostOutcome'

const port = process.env.E2E_PORT?.trim() || '3000'

const SEO_PATHS = [
  '/',
  '/robots.txt',
  '/sitemap.xml',
  '/pages-sitemap.xml',
  '/posts-sitemap.xml',
] as const

async function expectHtmlErrorPage(
  response: APIResponse,
  outcome: 'unknown' | 'failed',
) {
  const status = outcome === 'unknown' ? 404 : 503
  const title = outcome === 'unknown' ? 'Not found' : 'Unavailable'
  expect(response.status()).toBe(status)
  const body = await response.text()
  expect(body).toContain(`<title>${title}</title>`)
  expect(body).toMatch(/noindex/i)
  expect(body).not.toMatch(/favicon\.svg/i)
}

test.describe('Unknown host and failed lookup (E2E)', () => {
  test.describe.configure({ timeout: e2eSlowTestTimeout() })

  test('an unknown custom host returns 404 without the platform mark on public SEO paths', async ({
    testData,
    page,
  }) => {
    const nipIoAvailable = await isNipIoDnsAvailable()
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    const w = testData.workerIndex
    const stamp = Date.now()
    const unknownHost = `e2e-unknown-${w}-${stamp}.127.0.0.1.nip.io`

    for (const path of SEO_PATHS) {
      const response = await page.request.get(`http://${unknownHost}:${port}${path}`, {
        maxRedirects: 0,
        timeout: 60_000,
      })
      await expectHtmlErrorPage(response, 'unknown')
      const body = await response.text()
      expect(body).not.toMatch(/<loc>https:\/\//)
    }
  })

  test('a forced failed lookup returns 503 without a homepage sitemap', async ({ testData, page }) => {
    const nipIoAvailable = await isNipIoDnsAvailable()
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    const w = testData.workerIndex
    const stamp = Date.now()
    const canonicalHost = `e2e-fail-${w}-${stamp}.127.0.0.1.nip.io`
    const tenantName = `E2E Fail Lookup ${w} ${stamp}`
    const slug = `fail-${w}-${stamp}`

    const tenant = await createTestTenant(tenantName, slug, canonicalHost)
    await createTestPage(tenant.id, 'kids', 'Kids')

    const forceHeaders = { [E2E_FORCE_HOST_LOOKUP_FAILURE_HEADER]: '1' }

    for (const path of SEO_PATHS) {
      const response = await page.request.get(`http://${canonicalHost}:${port}${path}`, {
        maxRedirects: 0,
        timeout: 60_000,
        headers: forceHeaders,
      })
      await expectHtmlErrorPage(response, 'failed')
      const body = await response.text()
      expect(body).not.toMatch(/<loc>https:\/\/.*\/<\/loc>/)
    }
  })

  test('a resolved tenant without a logo keeps its name and emits no icon', async ({
    testData,
    page,
  }) => {
    const w = testData.workerIndex
    const stamp = Date.now()
    const slug = `nologo-${w}-${stamp}`
    const tenantName = `E2E No Logo ${w} ${stamp}`
    const host = `${slug}.localhost`

    const tenant = await createTestTenant(tenantName, slug)
    await createTestPage(tenant.id, 'kids', 'Kids')

    await page.goto(`http://${host}:${port}/kids`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await expect(page).toHaveTitle(tenantName)
    await expect(page.locator('link[rel="icon"]')).toHaveCount(0)
  })

  test('a tenant page without its own image emits no share image', async ({ testData, page }) => {
    const w = testData.workerIndex
    const stamp = Date.now()
    const slug = `noimg-${w}-${stamp}`
    const host = `${slug}.localhost`

    const tenant = await createTestTenant(`E2E No Image ${w} ${stamp}`, slug)
    await createTestPage(tenant.id, 'plain', 'Plain')

    await page.goto(`http://${host}:${port}/plain`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(0)
  })

  test('the platform host keeps the platform mark', async ({ page }) => {
    await page.goto(`http://localhost:${port}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await expect(page.locator('link[rel="icon"][href*="favicon"]')).toHaveCount(1)
  })
})
