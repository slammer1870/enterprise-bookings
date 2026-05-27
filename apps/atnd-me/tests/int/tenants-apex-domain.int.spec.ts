/**
 * Integration tests for apex domain redirect support on Tenants.
 * Covers findTenantByHost (single OR query) and the tenant-by-host API route.
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

describe('Apex domain — findTenantByHost', () => {
  let payload: Payload
  let wwwTenant: Tenant
  let apexTenant: Tenant   // separate tenant with redirectApex on a different domain
  let noApexTenant: Tenant // redirectApex: false

  const wwwDomain = `www.apex-int-${stamp}.example.com`
  const apexDomain = `apex-int-${stamp}.example.com`       // derived from wwwDomain

  const otherWww = `www.other-apex-int-${stamp}.example.com`
  const otherApex = `other-apex-int-${stamp}.example.com`

  const noApexWww = `www.noapex-int-${stamp}.example.com`

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    // Tenant 1: www.* domain with redirectApex enabled
    wwwTenant = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'Apex int tenant 1',
        slug: makeSlug('one'),
        domain: wwwDomain,
        redirectApex: true,
      },
      overrideAccess: true,
    })) as Tenant

    // Tenant 2: a different www.* domain with redirectApex enabled
    apexTenant = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'Apex int tenant 2',
        slug: makeSlug('two'),
        domain: otherWww,
        redirectApex: true,
      },
      overrideAccess: true,
    })) as Tenant

    // Tenant 3: redirectApex disabled
    noApexTenant = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'Apex int tenant 3 (no apex)',
        slug: makeSlug('three'),
        domain: noApexWww,
        redirectApex: false,
      },
      overrideAccess: true,
    })) as Tenant
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      for (const t of [wwwTenant, apexTenant, noApexTenant]) {
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

  it('resolves www domain as type=domain', async () => {
    const result = await findTenantByHost(payload, wwwDomain)
    expect(result).not.toBeNull()
    expect(result?.type).toBe('domain')
    expect(result?.slug).toBe(makeSlug('one'))
  }, TEST_TIMEOUT)

  it('resolves apex domain as type=apex with correct wwwDomain', async () => {
    const result = await findTenantByHost(payload, apexDomain)
    expect(result).not.toBeNull()
    expect(result?.type).toBe('apex')
    if (result?.type === 'apex') {
      expect(result.wwwDomain).toBe(wwwDomain)
      expect(result.slug).toBe(makeSlug('one'))
    }
  }, TEST_TIMEOUT)

  it('resolves the correct tenant when two tenants have redirectApex enabled', async () => {
    const result = await findTenantByHost(payload, otherApex)
    expect(result).not.toBeNull()
    expect(result?.type).toBe('apex')
    expect(result?.slug).toBe(makeSlug('two'))
  }, TEST_TIMEOUT)

  it('does not resolve apex when redirectApex is false', async () => {
    const noApexApex = noApexWww.slice(4) // strip 'www.'
    const result = await findTenantByHost(payload, noApexApex)
    expect(result).toBeNull()
  }, TEST_TIMEOUT)

  it('returns null for an unknown host', async () => {
    const result = await findTenantByHost(payload, 'totally-unknown.example.com')
    expect(result).toBeNull()
  }, TEST_TIMEOUT)

  it('persists apexDomain column when redirectApex is true', async () => {
    const fresh = await payload.findByID({
      collection: 'tenants',
      id: wwwTenant.id,
      overrideAccess: true,
    }) as Tenant & { apexDomain?: string | null }
    expect(fresh.apexDomain).toBe(apexDomain)
  }, TEST_TIMEOUT)

  it('clears apexDomain column when redirectApex is toggled off', async () => {
    await payload.update({
      collection: 'tenants',
      id: wwwTenant.id,
      data: { redirectApex: false },
      overrideAccess: true,
    })
    const fresh = await payload.findByID({
      collection: 'tenants',
      id: wwwTenant.id,
      overrideAccess: true,
    }) as Tenant & { apexDomain?: string | null }
    expect(fresh.apexDomain ?? null).toBeNull()

    // Restore for subsequent tests
    await payload.update({
      collection: 'tenants',
      id: wwwTenant.id,
      data: { redirectApex: true },
      overrideAccess: true,
    })
  }, TEST_TIMEOUT)
})
