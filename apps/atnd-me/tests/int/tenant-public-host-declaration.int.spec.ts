/**
 * Integration tests for tenant public host declaration rules.
 *
 * Run with: pnpm test:int -- tenant-public-host-declaration
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { Tenant, User } from '@repo/shared-types'

const TEST_TIMEOUT = 60_000
const HOOK_TIMEOUT = 300_000

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

const stamp = Date.now()

describe('Tenant public host declaration', () => {
  let payload: Payload
  let superAdmin: User
  let orgAdmin: User
  let tenantA: Tenant
  let tenantB: Tenant

  const slugA = `decl-a-${stamp}`
  const slugB = `decl-b-${stamp}`
  const registrableA = `unique-a-${stamp}.com`
  const registrableB = `unique-b-${stamp}.com`
  const domainA = `www.${registrableA}`
  const domainB = `www.${registrableB}`
  const apexA = registrableA

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    superAdmin = (await payload.create({
      collection: 'users',
      data: {
        name: 'Decl super admin',
        email: `decl-super-${stamp}@test.com`,
        password: 'test',
        role: ['super-admin'],
        emailVerified: true,
      },
      overrideAccess: true,
    })) as User

    tenantA = (await payload.create({
      collection: 'tenants',
      data: { name: `Decl A ${stamp}`, slug: slugA, domain: domainA },
      overrideAccess: true,
    })) as Tenant

    tenantB = (await payload.create({
      collection: 'tenants',
      data: { name: `Decl B ${stamp}`, slug: slugB },
      overrideAccess: true,
    })) as Tenant

    orgAdmin = (await payload.create({
      collection: 'users',
      data: {
        name: 'Decl org admin',
        email: `decl-org-${stamp}@test.com`,
        password: 'test',
        role: ['admin'],
        emailVerified: true,
        tenants: [{ tenant: tenantB.id, roles: ['admin'] }],
      },
      overrideAccess: true,
    })) as User
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (!payload) return
    try {
      await payload.delete({
        collection: 'users',
        where: { email: { contains: `decl-${stamp}` } },
        overrideAccess: true,
      })
      for (const t of [tenantA, tenantB]) {
        if (t?.id) {
          await payload.delete({
            collection: 'tenants',
            where: { id: { equals: t.id } },
            overrideAccess: true,
          })
        }
      }
    } catch {
      // ignore cleanup errors
    }
    await payload.db?.destroy?.()
  }, TEST_TIMEOUT)

  it('refuses a hostname with a port', async () => {
    await expect(
      payload.update({
        collection: 'tenants',
        id: tenantB.id,
        data: { domain: `www.${registrableB}:443` },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/port/i)
  }, TEST_TIMEOUT)

  it('refuses alias hosts without a canonical host', async () => {
    await expect(
      payload.update({
        collection: 'tenants',
        id: tenantB.id,
        data: { aliasHosts: ['www.example.org'] },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/canonical host/i)
  }, TEST_TIMEOUT)

  it('refuses a hostname already used as another tenant canonical host', async () => {
    await expect(
      payload.update({
        collection: 'tenants',
        id: tenantB.id,
        data: { domain: domainA },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/already uses/i)
  }, TEST_TIMEOUT)

  it('refuses a hostname on an apex another tenant has claimed', async () => {
    await expect(
      payload.update({
        collection: 'tenants',
        id: tenantB.id,
        data: { domain: apexA },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/apex/i)
  }, TEST_TIMEOUT)

  it('applies the same refusal rules to an org admin', async () => {
    await expect(
      payload.update({
        collection: 'tenants',
        id: tenantB.id,
        data: { domain: domainA },
        user: orgAdmin,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/already uses/i)
  }, TEST_TIMEOUT)

  it('lets an org admin save a valid canonical host', async () => {
    const updated = await payload.update({
      collection: 'tenants',
      id: tenantB.id,
      data: { domain: domainB },
      user: orgAdmin,
      overrideAccess: false,
    })
    expect(updated.domain).toBe(domainB)
  }, TEST_TIMEOUT)

  it('frees an apex after the last hostname on it is removed', async () => {
    const slugC = `decl-c-${stamp}`
    const registrableC = `unique-c-${stamp}.co.uk`
    const deepHost = `blog.shop.${registrableC}`
    const otherOnApex = `other.${registrableC}`

    const tenantC = (await payload.create({
      collection: 'tenants',
      data: { name: `Decl C ${stamp}`, slug: slugC, domain: deepHost },
      overrideAccess: true,
    })) as Tenant

    await expect(
      payload.update({
        collection: 'tenants',
        id: tenantB.id,
        data: { domain: otherOnApex },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/apex/i)

    await payload.update({
      collection: 'tenants',
      id: tenantC.id,
      data: { domain: null },
      overrideAccess: true,
    })

    const updated = await payload.update({
      collection: 'tenants',
      id: tenantB.id,
      data: { domain: otherOnApex },
      overrideAccess: true,
    })
    expect(updated.domain).toBe(otherOnApex)

    await payload.delete({
      collection: 'tenants',
      where: { id: { equals: tenantC.id } },
      overrideAccess: true,
    })
  }, TEST_TIMEOUT)
})
