/**
 * Integration tests for Direction on a www/apex pair.
 * A named apex with Redirect to www is an alias. An apex that is not in the list is not a public host.
 *
 * Run with: pnpm test:int -- tenants-apex-domain
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { findTenantByHost } from '@/lib/tenantDbResolve'
import type { Tenant } from '@repo/shared-types'

const TEST_TIMEOUT = 60_000
const HOOK_TIMEOUT = 300_000

// ---------------------------------------------------------------------------
// Mock Cloudflare + Stripe so afterChange hooks don't make real network calls
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const stamp = Date.now()

function makeSlug(label: string) {
  return `apex-int-${label}-${stamp}`
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Apex hostname — findTenantByHost', () => {
  let payload: Payload
  let wwwTenant: Tenant
  let otherTenant: Tenant
  let loneWwwTenant: Tenant

  const wwwDomain = `www.apex-int-${stamp}.com`
  const apexDomain = `apex-int-${stamp}.com`

  const otherWww = `www.other-apex-int-${stamp}.com`
  const otherApex = `other-apex-int-${stamp}.com`

  const loneWww = `www.noapex-int-${stamp}.com`

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    wwwTenant = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'Apex int tenant 1',
        slug: makeSlug('one'),
        hostnames: [wwwDomain, apexDomain],
        direction: 'redirect-to-www',
      },
      overrideAccess: true,
    })) as Tenant

    otherTenant = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'Apex int tenant 2',
        slug: makeSlug('two'),
        hostnames: [otherWww, otherApex],
        direction: 'redirect-to-www',
      },
      overrideAccess: true,
    })) as Tenant

    loneWwwTenant = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'Apex int tenant 3 (www only)',
        slug: makeSlug('three'),
        hostnames: [loneWww],
        direction: 'allow-www-and-non-www',
      },
      overrideAccess: true,
    })) as Tenant
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      for (const t of [wwwTenant, otherTenant, loneWwwTenant]) {
        if (!t?.id) continue
        await payload.delete({
          collection: 'tenants',
          where: { id: { equals: t.id } },
          overrideAccess: true,
        }).catch(() => null)
      }
      await payload.db?.destroy?.()
    }
  }, TEST_TIMEOUT)

  it('resolves www as a serving host', async () => {
    const result = await findTenantByHost(payload, wwwDomain)
    expect(result).not.toBeNull()
    expect(result?.type).toBe('domain')
    expect(result?.slug).toBe(makeSlug('one'))
  }, TEST_TIMEOUT)

  it('resolves the named apex as an alias to www when Direction is Redirect to www', async () => {
    const result = await findTenantByHost(payload, apexDomain)
    expect(result).toMatchObject({
      type: 'alias',
      slug: makeSlug('one'),
      canonicalHost: wwwDomain,
    })
  }, TEST_TIMEOUT)

  it('resolves another tenant apex as an alias to that tenant www host', async () => {
    const result = await findTenantByHost(payload, otherApex)
    expect(result).toMatchObject({
      type: 'alias',
      slug: makeSlug('two'),
      canonicalHost: otherWww,
    })
  }, TEST_TIMEOUT)

  it('does not resolve an apex that is not in the hostname list', async () => {
    const unnamedApex = loneWww.slice(4)
    const result = await findTenantByHost(payload, unnamedApex)
    expect(result).toBeNull()
  }, TEST_TIMEOUT)

  it('returns null for an unknown host', async () => {
    const result = await findTenantByHost(payload, 'totally-unknown.example.com')
    expect(result).toBeNull()
  }, TEST_TIMEOUT)
})
