/**
 * A tenant stored with only the hostname list and Direction still resolves.
 * Mapping from the old columns is covered in the unit test. Those columns are gone.
 *
 * Run with: pnpm test:int -- migrate-tenant-public-hosts
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { findTenantByHost } from '@/lib/tenantDbResolve'

vi.mock('@/lib/cloudflare/customHostnames', () => ({
  createOrGetCustomHostname: vi.fn().mockResolvedValue({
    id: 'csh_test',
    verificationTxtValue: 'txt-token-mock',
    status: 'pending',
  }),
}))

vi.mock('@/lib/stripe/platform', () => ({
  getPlatformStripe: () => ({
    paymentMethodDomains: {
      list: vi.fn().mockResolvedValue({ data: [] }),
      create: vi.fn().mockResolvedValue({ id: 'pmd_mock', enabled: true }),
      update: vi.fn().mockResolvedValue({ id: 'pmd_mock', enabled: true }),
    },
  }),
}))

const TEST_TIMEOUT = 60_000
const HOOK_TIMEOUT = 300_000
const stamp = Date.now()

describe('hostname list still resolves after the old declaration fields are gone', () => {
  let payload: Payload
  const ids: Array<number | string> = []

  const apex = `bru${stamp}.example`
  const www = `www.${apex}`
  const extra = `keep-me${stamp}.example.net`
  const redirectApex = `wwwpair${stamp}.example`
  const redirectWww = `www.${redirectApex}`

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const bru = await payload.create({
      collection: 'tenants',
      data: {
        name: `Migrated Bru ${stamp}`,
        slug: `mig-bru-${stamp}`,
        hostnames: [apex, www, extra],
        direction: 'redirect-to-non-www',
      },
      overrideAccess: true,
    })
    const redirect = await payload.create({
      collection: 'tenants',
      data: {
        name: `Migrated www ${stamp}`,
        slug: `mig-www-${stamp}`,
        hostnames: [redirectWww, redirectApex],
        direction: 'redirect-to-www',
      },
      overrideAccess: true,
    })
    const empty = await payload.create({
      collection: 'tenants',
      data: {
        name: `Migrated empty ${stamp}`,
        slug: `mig-empty-${stamp}`,
        hostnames: [],
        direction: 'allow-www-and-non-www',
      },
      overrideAccess: true,
    })
    ids.push(bru.id, redirect.id, empty.id)
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (!payload) return
    for (const id of ids) {
      await payload.delete({ collection: 'tenants', id, overrideAccess: true }).catch(() => null)
    }
    await payload.db?.destroy?.()
  }, TEST_TIMEOUT)

  it('serves the apex, redirects www to it, and serves a hostname with no pair partner', async () => {
    expect(await findTenantByHost(payload, apex)).toMatchObject({
      type: 'domain',
      slug: `mig-bru-${stamp}`,
    })
    expect(await findTenantByHost(payload, www)).toMatchObject({
      type: 'alias',
      slug: `mig-bru-${stamp}`,
      canonicalHost: apex,
    })
    expect(await findTenantByHost(payload, extra)).toMatchObject({
      type: 'domain',
      slug: `mig-bru-${stamp}`,
    })
  }, TEST_TIMEOUT)

  it('redirects a named apex to www when Direction is Redirect to www', async () => {
    expect(await findTenantByHost(payload, redirectWww)).toMatchObject({
      type: 'domain',
      slug: `mig-www-${stamp}`,
    })
    expect(await findTenantByHost(payload, redirectApex)).toMatchObject({
      type: 'alias',
      slug: `mig-www-${stamp}`,
      canonicalHost: redirectWww,
    })
  }, TEST_TIMEOUT)

  it('does not resolve a hostname for a tenant whose list is empty', async () => {
    expect(await findTenantByHost(payload, `unused${stamp}.example`)).toBeNull()
  }, TEST_TIMEOUT)
})
