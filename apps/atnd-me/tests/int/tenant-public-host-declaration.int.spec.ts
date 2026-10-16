/**
 * Integration tests for tenant public host declaration rules.
 *
 * Run with: pnpm test:int -- tenant-public-host-declaration
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { findTenantByHost } from '@/lib/tenantDbResolve'
import type { Tenant, User } from '@repo/shared-types'
import {
  getClaimedApex,
  getTenantPlatformSubdomain,
  readHostnameDeclaration,
} from '@/utilities/tenantPublicHostDeclaration'
import { getPlatformRootHostname } from '@/utilities/validateCustomDomain'

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

const originalServerUrl = process.env.NEXT_PUBLIC_SERVER_URL
process.env.NEXT_PUBLIC_SERVER_URL = 'https://atnd.me'

const stamp = Date.now()

describe('Tenant public host declaration', () => {
  let payload: Payload
  let superAdmin: User
  let orgAdmin: User
  let tenantA: Tenant
  let tenantB: Tenant
  let tenantList: Tenant

  const slugA = `decl-a-${stamp}`
  const slugB = `decl-b-${stamp}`
  const slugList = `decl-list-${stamp}`
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

    tenantList = (await payload.create({
      collection: 'tenants',
      data: { name: `Decl list ${stamp}`, slug: slugList },
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
    try {
      if (!payload) return
      try {
        await payload.delete({
          collection: 'users',
          where: { email: { contains: `decl-${stamp}` } },
          overrideAccess: true,
        })
        for (const t of [tenantA, tenantB, tenantList]) {
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
    } finally {
      if (originalServerUrl === undefined) delete process.env.NEXT_PUBLIC_SERVER_URL
      else process.env.NEXT_PUBLIC_SERVER_URL = originalServerUrl
    }
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

  it('applies the same refusal rules to a super admin with access enforced', async () => {
    await expect(
      payload.update({
        collection: 'tenants',
        id: tenantB.id,
        data: { domain: domainA },
        user: superAdmin,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/already uses/i)
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

  it('refuses a scheme in the hostname on save', async () => {
    await expect(
      payload.update({
        collection: 'tenants',
        id: tenantB.id,
        data: { domain: `https://www.${registrableB}` },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/protocol|hostname/i)
  }, TEST_TIMEOUT)

  it('refuses clearing the canonical host while alias hosts remain', async () => {
    await payload.update({
      collection: 'tenants',
      id: tenantB.id,
      data: { domain: domainB, aliasHosts: [`alt.${registrableB}`] },
      overrideAccess: true,
    })

    await expect(
      payload.update({
        collection: 'tenants',
        id: tenantB.id,
        data: { domain: null },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/alias hosts before removing/i)
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

  const listRegistrable = `list-${stamp}.com`
  const listWww = `www.${listRegistrable}`
  const listApex = listRegistrable

  async function readStoredList() {
    const doc = (await payload.findByID({
      collection: 'tenants',
      id: tenantList.id,
      overrideAccess: true,
    })) as Tenant & { hostnames?: unknown; direction?: unknown }
    return { doc, read: readHostnameDeclaration(doc) }
  }

  it('stores an ordered hostname list and Allow www and non-www, and derives roles on read', async () => {
    const platformHost = getTenantPlatformSubdomain(slugList)
    await payload.update({
      collection: 'tenants',
      id: tenantList.id,
      data: { hostnames: [listWww, listApex] },
      overrideAccess: true,
    })

    const { doc, read } = await readStoredList()
    expect(doc.hostnames).toEqual([listWww, listApex])
    expect(doc.direction).toBe('allow-www-and-non-www')
    expect(doc).not.toHaveProperty('servingHosts')
    expect(read.roles).toEqual({
      canonicalHost: listApex,
      servingHosts: [listWww, listApex],
      aliases: [{ host: platformHost, target: listApex }],
    })
  }, TEST_TIMEOUT)

  it('stores hostnames in lowercase and keeps typed order', async () => {
    await payload.update({
      collection: 'tenants',
      id: tenantList.id,
      data: { hostnames: [`WWW.${listRegistrable}`, listRegistrable] },
      overrideAccess: true,
    })

    const { doc } = await readStoredList()
    expect(doc.hostnames).toEqual([listWww, listApex])
  }, TEST_TIMEOUT)

  it('stores Redirect to www and derives www as canonical with the apex aliasing to it', async () => {
    const platformHost = getTenantPlatformSubdomain(slugList)
    await payload.update({
      collection: 'tenants',
      id: tenantList.id,
      data: { hostnames: [listWww, listApex], direction: 'redirect-to-www' },
      overrideAccess: true,
    })

    const { doc, read } = await readStoredList()
    expect(doc.hostnames).toEqual([listWww, listApex])
    expect(doc.direction).toBe('redirect-to-www')
    expect(read.roles).toEqual({
      canonicalHost: listWww,
      servingHosts: [listWww],
      aliases: [
        { host: listApex, target: listWww },
        { host: platformHost, target: listWww },
      ],
    })
  }, TEST_TIMEOUT)

  it('stores Redirect to non-www and derives the apex as canonical with www aliasing to it', async () => {
    const platformHost = getTenantPlatformSubdomain(slugList)
    await payload.update({
      collection: 'tenants',
      id: tenantList.id,
      data: { hostnames: [listWww, listApex], direction: 'redirect-to-non-www' },
      overrideAccess: true,
    })

    const { doc, read } = await readStoredList()
    expect(doc.direction).toBe('redirect-to-non-www')
    expect(read.roles).toEqual({
      canonicalHost: listApex,
      servingHosts: [listApex],
      aliases: [
        { host: listWww, target: listApex },
        { host: platformHost, target: listApex },
      ],
    })
  }, TEST_TIMEOUT)

  it('changing Direction changes derived roles without rewriting the stored hostname list', async () => {
    await payload.update({
      collection: 'tenants',
      id: tenantList.id,
      data: { hostnames: [listWww, listApex], direction: 'allow-www-and-non-www' },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'tenants',
      id: tenantList.id,
      data: { direction: 'redirect-to-www' },
      overrideAccess: true,
    })

    const { doc, read } = await readStoredList()
    expect(doc.hostnames).toEqual([listWww, listApex])
    expect(doc.direction).toBe('redirect-to-www')
    expect(read.roles?.canonicalHost).toBe(listWww)
    expect(read.roles?.aliases).toEqual(
      expect.arrayContaining([{ host: listApex, target: listWww }]),
    )
  }, TEST_TIMEOUT)

  it('serves a named hostname that has no pair partner and does not store the missing partner', async () => {
    const lone = `www.lone-${stamp}.com`
    const platformHost = getTenantPlatformSubdomain(slugList)
    await payload.update({
      collection: 'tenants',
      id: tenantList.id,
      data: { hostnames: [lone], direction: 'allow-www-and-non-www' },
      overrideAccess: true,
    })

    const { doc, read } = await readStoredList()
    expect(doc.hostnames).toEqual([lone])
    expect(read.roles).toEqual({
      canonicalHost: lone,
      servingHosts: [lone],
      aliases: [{ host: platformHost, target: lone }],
    })
  }, TEST_TIMEOUT)

  it('stores an empty list as Allow www and non-www with the platform subdomain as the only serving host', async () => {
    const platformHost = getTenantPlatformSubdomain(slugList)
    await payload.update({
      collection: 'tenants',
      id: tenantList.id,
      data: { hostnames: [listApex], direction: 'allow-www-and-non-www' },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'tenants',
      id: tenantList.id,
      data: { hostnames: [] },
      overrideAccess: true,
    })

    const { doc, read } = await readStoredList()
    expect(doc.hostnames).toEqual([])
    expect(doc.direction).toBe('allow-www-and-non-www')
    expect(read.roles).toEqual({
      canonicalHost: platformHost,
      servingHosts: [platformHost],
      aliases: [],
    })
  }, TEST_TIMEOUT)

  it('refuses Redirect to www unless www of the first hostname is in the list, even when a later pair has it', async () => {
    const first = `blog.list-${stamp}.com`
    const laterWww = `www.later-${stamp}.com`
    const laterApex = `later-${stamp}.com`
    await payload.update({
      collection: 'tenants',
      id: tenantList.id,
      data: { hostnames: [listWww, listApex], direction: 'allow-www-and-non-www' },
      overrideAccess: true,
    })

    await expect(
      payload.update({
        collection: 'tenants',
        id: tenantList.id,
        data: {
          hostnames: [first, laterWww, laterApex],
          direction: 'redirect-to-www',
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/redirect to www/i)

    const { doc } = await readStoredList()
    expect(doc.hostnames).toEqual([listWww, listApex])
    expect(doc.direction).toBe('allow-www-and-non-www')
  }, TEST_TIMEOUT)

  it('refuses Redirect to non-www unless the apex of the first hostname is in the list', async () => {
    await payload.update({
      collection: 'tenants',
      id: tenantList.id,
      data: { hostnames: [listWww, listApex], direction: 'redirect-to-non-www' },
      overrideAccess: true,
    })

    await expect(
      payload.update({
        collection: 'tenants',
        id: tenantList.id,
        data: { hostnames: [listWww], direction: 'redirect-to-non-www' },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/redirect to non-www/i)

    const { doc } = await readStoredList()
    expect(doc.hostnames).toEqual([listWww, listApex])
    expect(doc.direction).toBe('redirect-to-non-www')
  }, TEST_TIMEOUT)

  it('refuses a scheme, path, port, trailing dot, localhost, or IP address and leaves the stored declaration', async () => {
    await payload.update({
      collection: 'tenants',
      id: tenantList.id,
      data: { hostnames: [listApex], direction: 'allow-www-and-non-www' },
      overrideAccess: true,
    })

    const refused = [
      `https://${listApex}`,
      `${listApex}/kids`,
      `${listApex}:443`,
      `${listApex}.`,
      'localhost',
      'foo.localhost',
      '127.0.0.1',
      '::1',
    ]
    for (const hostname of refused) {
      await expect(
        payload.update({
          collection: 'tenants',
          id: tenantList.id,
          data: { hostnames: [hostname] },
          overrideAccess: true,
        }),
      ).rejects.toThrow()
    }

    const { doc } = await readStoredList()
    expect(doc.hostnames).toEqual([listApex])
    expect(doc.direction).toBe('allow-www-and-non-www')
  }, TEST_TIMEOUT)

  it('refuses the platform host, the platform apex, and a subdomain of the platform apex', async () => {
    const root = getPlatformRootHostname()
    expect(root).toBeTruthy()
    const platformHost = root as string
    const platformApex = getClaimedApex(platformHost)
    await expect(
      payload.update({
        collection: 'tenants',
        id: tenantList.id,
        data: { hostnames: [platformHost] },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/platform/i)
    await expect(
      payload.update({
        collection: 'tenants',
        id: tenantList.id,
        data: { hostnames: [platformApex] },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/platform/i)
    await expect(
      payload.update({
        collection: 'tenants',
        id: tenantList.id,
        data: { hostnames: [`not-a-tenant.${platformApex}`] },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/platform/i)
  }, TEST_TIMEOUT)

  it('refuses a repeated hostname', async () => {
    await expect(
      payload.update({
        collection: 'tenants',
        id: tenantList.id,
        data: { hostnames: [listApex, listApex.toUpperCase()] },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/once/i)
  }, TEST_TIMEOUT)

  it('refuses a hostname another tenant has named, and another tenant platform subdomain', async () => {
    await expect(
      payload.update({
        collection: 'tenants',
        id: tenantList.id,
        data: { hostnames: [domainA] },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/already uses/i)

    const otherPlatform = getTenantPlatformSubdomain(slugA)
    await expect(
      payload.update({
        collection: 'tenants',
        id: tenantList.id,
        data: { hostnames: [otherPlatform] },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/platform|reserved/i)
  }, TEST_TIMEOUT)

  it('claims the registrable apex of a named hostname and frees it when that hostname is removed', async () => {
    const registrable = `claim-${stamp}.co.uk`
    const named = `blog.shop.${registrable}`
    const otherOnApex = `other.${registrable}`

    await payload.update({
      collection: 'tenants',
      id: tenantList.id,
      data: { hostnames: [named], direction: 'allow-www-and-non-www' },
      overrideAccess: true,
    })

    await expect(
      payload.update({
        collection: 'tenants',
        id: tenantB.id,
        data: { domain: otherOnApex },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/apex/i)

    const { read } = await readStoredList()
    const published = [
      read.roles?.canonicalHost,
      ...(read.roles?.servingHosts ?? []),
      ...(read.roles?.aliases ?? []).map((alias) => alias.host),
    ]
    expect(published).not.toContain(registrable)
    expect(await findTenantByHost(payload, registrable)).toBeNull()

    await payload.update({
      collection: 'tenants',
      id: tenantList.id,
      data: { hostnames: [] },
      overrideAccess: true,
    })

    const updated = await payload.update({
      collection: 'tenants',
      id: tenantB.id,
      data: { domain: otherOnApex },
      overrideAccess: true,
    })
    expect(updated.domain).toBe(otherOnApex)
  }, TEST_TIMEOUT)

  it('resolves a row that only has the custom domain, the alias list, and Redirect apex as it does today', async () => {
    const legacySlug = `decl-legacy-${stamp}`
    const legacyWww = `www.legacy-${stamp}.com`
    const legacyAlias = `alt.legacy-${stamp}.com`
    const legacyApex = `legacy-${stamp}.com`
    const legacy = (await payload.create({
      collection: 'tenants',
      data: {
        name: `Decl legacy ${stamp}`,
        slug: legacySlug,
        domain: legacyWww,
        aliasHosts: [legacyAlias],
        redirectApex: true,
      },
      overrideAccess: true,
    })) as Tenant

    const domainHit = await findTenantByHost(payload, legacyWww)
    const aliasHit = await findTenantByHost(payload, legacyAlias)
    const apexHit = await findTenantByHost(payload, legacyApex)
    expect(domainHit).toMatchObject({ type: 'domain', slug: legacySlug })
    expect(aliasHit).toMatchObject({
      type: 'alias',
      slug: legacySlug,
      canonicalHost: legacyWww,
    })
    expect(apexHit).toBeNull()

    const doc = (await payload.findByID({
      collection: 'tenants',
      id: legacy.id,
      overrideAccess: true,
    })) as Tenant & { hostnames?: unknown; direction?: unknown }
    const read = readHostnameDeclaration(doc)
    expect(read.hostnames).toBeNull()
    expect(read.roles).toBeNull()

    await payload.delete({
      collection: 'tenants',
      where: { id: { equals: legacy.id } },
      overrideAccess: true,
    })
  }, TEST_TIMEOUT)
})
