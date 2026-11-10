/**
 * Apple Pay domains registered when a hostname declaration is saved.
 * The association file is not requested.
 *
 * Run with: pnpm test:int tests/int/apple-pay-serving-hosts.int.spec.ts
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'

const HOOK_TIMEOUT = 300_000
const TEST_TIMEOUT = 60_000

const { mockList, mockCreate, mockUpdate } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
}))

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
      list: mockList,
      create: mockCreate,
      update: mockUpdate,
    },
  }),
}))

const originalServerUrl = process.env.NEXT_PUBLIC_SERVER_URL
process.env.NEXT_PUBLIC_SERVER_URL = 'https://atnd.me'

const stamp = Date.now()

type Direction = 'allow-www-and-non-www' | 'redirect-to-www' | 'redirect-to-non-www'

function sentDomainNames(): string[] {
  const names = [
    ...mockList.mock.calls.map((call) => call[0]?.domain_name),
    ...mockCreate.mock.calls.map((call) => call[0]?.domain_name),
  ].filter((name): name is string => typeof name === 'string')
  return [...new Set(names)].sort()
}

function expectRegistered(hosts: string[]) {
  const expected = [...hosts].sort()
  expect(sentDomainNames()).toEqual(expected)
  expect(mockCreate.mock.calls.map((call) => call[0])).toEqual(
    expect.arrayContaining(hosts.map((domain_name) => ({ domain_name }))),
  )
  expect(mockCreate).toHaveBeenCalledTimes(hosts.length)
}

describe('Apple Pay domains on declaration save', () => {
  let payload: Payload
  const tenantIds: number[] = []

  beforeAll(async () => {
    delete process.env.SKIP_APPLE_PAY_DOMAIN_REGISTRATION
    delete process.env.ENABLE_TEST_WEBHOOKS
    delete process.env.PW_E2E_PROFILE
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_apple_pay'

    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
  }, HOOK_TIMEOUT)

  beforeEach(() => {
    mockList.mockReset()
    mockCreate.mockReset()
    mockUpdate.mockReset()
    mockList.mockResolvedValue({ data: [] })
    mockCreate.mockResolvedValue({ id: 'pmd_mock', enabled: true })
    mockUpdate.mockResolvedValue({ id: 'pmd_mock', enabled: true })
  })

  afterAll(async () => {
    process.env.SKIP_APPLE_PAY_DOMAIN_REGISTRATION = 'true'
    if (originalServerUrl === undefined) delete process.env.NEXT_PUBLIC_SERVER_URL
    else process.env.NEXT_PUBLIC_SERVER_URL = originalServerUrl

    if (!payload) return
    if (tenantIds.length > 0) {
      await payload.delete({
        collection: 'tenants',
        where: { id: { in: tenantIds } },
        overrideAccess: true,
      }).catch(() => null)
    }
    await payload.db?.destroy?.()
  }, TEST_TIMEOUT)

  async function createTenant(args: {
    slug: string
    name: string
    hostnames: string[]
    direction: Direction
  }) {
    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: args.name,
        slug: args.slug,
        hostnames: args.hostnames,
        direction: args.direction,
      },
      overrideAccess: true,
    })
    tenantIds.push(tenant.id as number)
    return tenant
  }

  it('registers both bare hostnames when www and the apex both serve', async () => {
    const www = `www.allow-${stamp}.com`
    const apex = `allow-${stamp}.com`

    await createTenant({
      slug: `apple-allow-${stamp}`,
      name: `Apple Pay allow ${stamp}`,
      hostnames: [www, apex],
      direction: 'allow-www-and-non-www',
    })

    expectRegistered([www, apex])
    expect(sentDomainNames()).not.toContain(`apple-allow-${stamp}.atnd.me`)
  }, TEST_TIMEOUT)

  it('registers www and does not register the apex when direction is redirect to www', async () => {
    const www = `www.towww-${stamp}.com`
    const apex = `towww-${stamp}.com`

    await createTenant({
      slug: `apple-towww-${stamp}`,
      name: `Apple Pay to www ${stamp}`,
      hostnames: [www, apex],
      direction: 'redirect-to-www',
    })

    expectRegistered([www])
  }, TEST_TIMEOUT)

  it('registers the apex and does not register www when direction is redirect to non-www', async () => {
    const www = `www.tonon-${stamp}.com`
    const apex = `tonon-${stamp}.com`

    await createTenant({
      slug: `apple-tonon-${stamp}`,
      name: `Apple Pay to non-www ${stamp}`,
      hostnames: [www, apex],
      direction: 'redirect-to-non-www',
    })

    expectRegistered([apex])
  }, TEST_TIMEOUT)

  it('registers a serving host outside the canonical pair and not a partner that does not serve', async () => {
    const www = `www.out-${stamp}.com`
    const apex = `out-${stamp}.com`
    const shop = `shop.out-${stamp}.com`
    const other = `other-${stamp}.com`

    await createTenant({
      slug: `apple-out-${stamp}`,
      name: `Apple Pay outside ${stamp}`,
      hostnames: [www, apex, shop, other],
      direction: 'redirect-to-www',
    })

    expectRegistered([www, shop, other])
  }, TEST_TIMEOUT)

  it('registers the pair partner of an outside host when that partner also serves', async () => {
    const www = `www.side-${stamp}.com`
    const apex = `side-${stamp}.com`
    const otherWww = `www.otherb-${stamp}.com`
    const otherApex = `otherb-${stamp}.com`

    await createTenant({
      slug: `apple-side-${stamp}`,
      name: `Apple Pay partner ${stamp}`,
      hostnames: [www, apex, otherWww, otherApex],
      direction: 'redirect-to-www',
    })

    expectRegistered([www, otherWww])
  }, TEST_TIMEOUT)

  it('registers only the platform subdomain when the hostname list is empty', async () => {
    const slug = `apple-empty-${stamp}`

    await createTenant({
      slug,
      name: `Apple Pay empty ${stamp}`,
      hostnames: [],
      direction: 'allow-www-and-non-www',
    })

    expectRegistered([`${slug}.atnd.me`])
  }, TEST_TIMEOUT)

  it('does not register a missing www or apex', async () => {
    const loneWww = `www.lonewww-${stamp}.com`
    await createTenant({
      slug: `apple-lonewww-${stamp}`,
      name: `Apple Pay lone www ${stamp}`,
      hostnames: [loneWww],
      direction: 'allow-www-and-non-www',
    })
    expectRegistered([loneWww])

    mockList.mockClear()
    mockCreate.mockClear()
    mockUpdate.mockClear()

    const loneApex = `loneapex-${stamp}.com`
    await createTenant({
      slug: `apple-loneapex-${stamp}`,
      name: `Apple Pay lone apex ${stamp}`,
      hostnames: [loneApex],
      direction: 'allow-www-and-non-www',
    })
    expectRegistered([loneApex])
  }, TEST_TIMEOUT)

  it('does not add or remove an Apple Pay domain when the serving set is unchanged', async () => {
    const www = `www.same-${stamp}.com`
    const apex = `same-${stamp}.com`

    const tenant = await createTenant({
      slug: `apple-same-${stamp}`,
      name: `Apple Pay same ${stamp}`,
      hostnames: [www, apex],
      direction: 'allow-www-and-non-www',
    })
    expectRegistered([www, apex])

    mockList.mockClear()
    mockCreate.mockClear()
    mockUpdate.mockClear()

    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: { name: `Apple Pay same renamed ${stamp}`, emailDomainStatus: 'pending' },
      overrideAccess: true,
    })

    expect(sentDomainNames()).toEqual([])
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockList).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  }, TEST_TIMEOUT)
})
