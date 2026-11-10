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

describe('Password reset email tenant From header', () => {
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

      await betterAuthPluginOptions.betterAuthOptions.emailAndPassword.sendResetPassword({
        user: { email: 'person@example.com', name: 'Person' },
        url: 'https://studio.example.com/reset-password?token=tok',
      })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [_url, init] = fetchMock.mock.calls[0] as any[]
      const payload = JSON.parse(init.body)
      expect(payload.to).toEqual(['person@example.com'])
      expect(payload.subject).toBe('Reset your Studio Yoga password')
      expect(payload.from).toBe('Studio Yoga <auth@example.com>')
    },
    15_000,
  )

  it('uses platform From when custom domain is not Resend-verified', async () => {
    const { findImpl, executeImpl } = namedHost({
      name: 'Studio Yoga',
      slug: 'studio',
      hostnames: ['studio.example.com'],
      emailDomainStatus: 'not_started',
    })

    const { betterAuthPluginOptions, fetchMock } = await setup({ findImpl, executeImpl })

    await betterAuthPluginOptions.betterAuthOptions.emailAndPassword.sendResetPassword({
      user: { email: 'person@example.com', name: 'Person' },
      url: 'https://studio.example.com/reset-password?token=tok',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [_url, init] = fetchMock.mock.calls[0] as any[]
    const payload = JSON.parse(init.body)
    expect(payload.from).toBe('Studio Yoga <auth@atnd.me>')
  })

  it('uses tenant name and auth@atnd.me for platform subdomains', async () => {
    const findImpl = vi.fn(async ({ collection, where }: any) => {
      expect(collection).toBe('tenants')
      expect(where).toEqual({ slug: { equals: 'acme' } })
      return { docs: [{ name: 'Acme Gym', slug: 'acme', hostnames: [] }] }
    })

    const { betterAuthPluginOptions, fetchMock } = await setup({ findImpl })

    await betterAuthPluginOptions.betterAuthOptions.emailAndPassword.sendResetPassword({
      user: { email: 'person@example.com', name: 'Person' },
      url: 'https://acme.atnd-me.com/reset-password?token=tok',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [_url, init] = fetchMock.mock.calls[0] as any[]
    const payload = JSON.parse(init.body)
    expect(payload.subject).toBe('Reset your Acme Gym password')
    expect(payload.from).toBe('Acme Gym <auth@atnd.me>')
  })

  it('falls back when tenant domain contains env-style injection (=)', async () => {
    const { findImpl, executeImpl } = namedHost({
      name: 'Studio Yoga',
      slug: 'studio',
      hostnames: ['ATNDSTRIPE_CONNECT_CLIENT_ID=ca_xxx', 'bad.example.com'],
      emailDomainStatus: 'verified',
    })

    const { betterAuthPluginOptions, fetchMock } = await setup({ findImpl, executeImpl })

    await betterAuthPluginOptions.betterAuthOptions.emailAndPassword.sendResetPassword({
      user: { email: 'person@example.com', name: 'Person' },
      url: 'https://bad.example.com/reset-password?token=tok',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [_url, init] = fetchMock.mock.calls[0] as any[]
    const payload = JSON.parse(init.body)
    expect(payload.from).toBe('Studio Yoga <auth@atnd.me>')
  })
})

