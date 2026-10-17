import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

async function setup({
  findImpl,
  executeImpl,
}: {
  findImpl: (args: any) => Promise<any>
  executeImpl?: () => Promise<unknown>
}) {
  vi.resetModules()

  process.env.NODE_ENV = 'development'
  delete process.env.CI
  process.env.NEXT_PUBLIC_SERVER_URL = 'https://atnd-me.com'
  process.env.RESEND_API_KEY = 'test'

  vi.doMock('@/lib/payload', () => ({
    getPayload: async () => ({
      find: findImpl,
      ...(executeImpl ? { db: { drizzle: { execute: executeImpl } } } : {}),
    }),
  }))

  const fetchMock = vi.fn(async (_url: string, _init?: any) => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => '',
  }))
  vi.stubGlobal('fetch', fetchMock)

  const { betterAuthPluginOptions } = await import('../../src/lib/auth/options')

  return {
    fetchMock,
    betterAuthPluginOptions,
  }
}

function namedHost(args: {
  name: string
  slug: string
  hostnames: string[]
  emailDomainStatus?: string
}) {
  const direction = 'allow-www-and-non-www'
  const doc = {
    name: args.name,
    slug: args.slug,
    hostnames: args.hostnames,
    direction,
    emailDomainStatus: args.emailDomainStatus,
  }
  return {
    findImpl: vi.fn(async ({ collection, where }: any) => {
      expect(collection).toBe('tenants')
      expect(where).toEqual({ slug: { equals: args.slug } })
      return { docs: [doc] }
    }),
    executeImpl: async () => ({
      rows: [{ id: 1, slug: args.slug, hostnames: args.hostnames, direction }],
    }),
  }
}

describe('Magic-link email tenant From header', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.restoreAllMocks()
  })

  it(
    'uses tenant name and auth@{tenant domain} for custom domains',
    async () => {
    const { findImpl, executeImpl } = namedHost({
      name: 'Studio Yoga',
      slug: 'studio',
      hostnames: ['studio.example.com'],
      emailDomainStatus: 'verified',
    })

    const { betterAuthPluginOptions, fetchMock } = await setup({ findImpl, executeImpl })

    await betterAuthPluginOptions.betterAuthOptions.magicLink.sendMagicLink({
      email: 'person@example.com',
      token: 'tok',
      url: 'https://studio.example.com/api/auth/magic-link?token=tok',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [_url, init] = fetchMock.mock.calls[0] as any[]
    const payload = JSON.parse(init.body)
    expect(payload.to).toEqual(['person@example.com'])
    expect(payload.subject).toMatch(/^Sign in to Studio Yoga\b/)
    expect(payload.from).toBe('Studio Yoga <auth@example.com>')
    },
    15_000,
  )

  it('uses platform From when custom domain is not Resend-verified', async () => {
    const { findImpl, executeImpl } = namedHost({
      name: 'Studio Yoga',
      slug: 'studio',
      hostnames: ['studio.example.com'],
      emailDomainStatus: 'pending',
    })

    const { betterAuthPluginOptions, fetchMock } = await setup({ findImpl, executeImpl })

    await betterAuthPluginOptions.betterAuthOptions.magicLink.sendMagicLink({
      email: 'person@example.com',
      token: 'tok',
      url: 'https://studio.example.com/api/auth/magic-link?token=tok',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [_url, init] = fetchMock.mock.calls[0] as any[]
    const payload = JSON.parse(init.body)
    expect(payload.from).toBe('Studio Yoga <auth@atnd.me>')
  })

  it('transliterates accented tenant names in the From header', async () => {
    const { findImpl, executeImpl } = namedHost({
      name: 'Brú Grappling',
      slug: 'bru',
      hostnames: ['bru.example.com'],
      emailDomainStatus: 'verified',
    })

    const { betterAuthPluginOptions, fetchMock } = await setup({ findImpl, executeImpl })

    await betterAuthPluginOptions.betterAuthOptions.magicLink.sendMagicLink({
      email: 'person@example.com',
      token: 'tok',
      url: 'https://bru.example.com/api/auth/magic-link?token=tok',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [_url, init] = fetchMock.mock.calls[0] as any[]
    const payload = JSON.parse(init.body)
    expect(payload.subject).toMatch(/^Sign in to Brú Grappling\b/)
    expect(payload.from).toBe('Bru Grappling <auth@example.com>')
  })

  it('falls back when tenant domain contains env-style injection (=)', async () => {
    const { findImpl, executeImpl } = namedHost({
      name: 'Studio Yoga',
      slug: 'studio',
      hostnames: ['ATNDSTRIPE_CONNECT_CLIENT_ID=ca_xxx', 'bad.example.com'],
      emailDomainStatus: 'verified',
    })

    const { betterAuthPluginOptions, fetchMock } = await setup({ findImpl, executeImpl })

    await betterAuthPluginOptions.betterAuthOptions.magicLink.sendMagicLink({
      email: 'person@example.com',
      token: 'tok',
      url: 'https://bad.example.com/api/auth/magic-link?token=tok',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [_url, init] = fetchMock.mock.calls[0] as any[]
    const payload = JSON.parse(init.body)
    // The sending domain includes '=' so sanitizeFromAddress rejects it; fall back to auth@atnd.me.
    expect(payload.from).toBe('Studio Yoga <auth@atnd.me>')
  })

  it('uses tenant name and auth@atnd.me for platform subdomains', async () => {
    const findImpl = vi.fn(async ({ collection, where }: any) => {
      expect(collection).toBe('tenants')
      expect(where).toEqual({ slug: { equals: 'acme' } })
      return { docs: [{ name: 'Acme Gym', slug: 'acme', hostnames: [] }] }
    })

    const { betterAuthPluginOptions, fetchMock } = await setup({ findImpl })

    await betterAuthPluginOptions.betterAuthOptions.magicLink.sendMagicLink({
      email: 'person@example.com',
      token: 'tok',
      url: 'https://acme.atnd-me.com/api/auth/magic-link?token=tok',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [_url, init] = fetchMock.mock.calls[0] as any[]
    const payload = JSON.parse(init.body)
    expect(payload.to).toEqual(['person@example.com'])
    expect(payload.subject).toMatch(/^Sign in to Acme Gym\b/)
    expect(payload.from).toBe('Acme Gym <auth@atnd.me>')
  })

  it('falls back to DEFAULT_FROM_ADDRESS when Resend rejects unverified from domain', async () => {
    const findImpl = vi.fn(async ({ collection, where }: any) => {
      expect(collection).toBe('tenants')
      expect(where).toEqual({ slug: { equals: 'acme' } })
      return { docs: [{ name: 'Acme Gym', slug: 'acme', hostnames: [] }] }
    })

    const { betterAuthPluginOptions, fetchMock } = await setup({ findImpl })
    process.env.DEFAULT_FROM_NAME = 'ATND ME'
    process.env.DEFAULT_FROM_ADDRESS = 'auth@atnd-me.com'

    fetchMock.mockImplementationOnce(async () => ({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () =>
        '{"statusCode":403,"message":"The atnd.me domain is not verified.","name":"validation_error"}',
    }))

    await betterAuthPluginOptions.betterAuthOptions.magicLink.sendMagicLink({
      email: 'person@example.com',
      token: 'tok',
      url: 'https://acme.atnd-me.com/api/auth/magic-link?token=tok',
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)

    const [_url1, init1] = fetchMock.mock.calls[0] as any[]
    const payload1 = JSON.parse(init1.body)
    expect(payload1.from).toBe('Acme Gym <auth@atnd.me>')

    const [_url2, init2] = fetchMock.mock.calls[1] as any[]
    const payload2 = JSON.parse(init2.body)
    expect(payload2.from).toBe('Acme Gym <auth@atnd-me.com>')
  })
})

