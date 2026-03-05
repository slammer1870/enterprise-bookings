import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

async function setup({ findImpl }: { findImpl: (args: any) => Promise<any> }) {
  vi.resetModules()

  process.env.NODE_ENV = 'development'
  delete process.env.CI
  process.env.NEXT_PUBLIC_SERVER_URL = 'https://atnd-me.com'
  process.env.RESEND_API_KEY = 'test'

  vi.doMock('@/lib/payload', () => ({
    getPayload: async () => ({
      find: findImpl,
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

describe('Magic-link email tenant From header', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.restoreAllMocks()
  })

  it('uses tenant name and auth@{tenant domain} for custom domains', async () => {
    const findImpl = vi.fn(async ({ collection, where }: any) => {
      expect(collection).toBe('tenants')
      expect(where).toEqual({ domain: { equals: 'studio.example.com' } })
      return { docs: [{ name: 'Studio Yoga', domain: 'studio.example.com' }] }
    })

    const { betterAuthPluginOptions, fetchMock } = await setup({ findImpl })

    await betterAuthPluginOptions.betterAuthOptions.magicLink.sendMagicLink({
      email: 'person@example.com',
      token: 'tok',
      url: 'https://studio.example.com/api/auth/magic-link?token=tok',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [_url, init] = fetchMock.mock.calls[0] as any[]
    const payload = JSON.parse(init.body)
    expect(payload.to).toEqual(['person@example.com'])
    expect(payload.subject).toBe('Sign in to Studio Yoga')
    expect(payload.from).toBe('Studio Yoga <auth@studio.example.com>')
  })

  it('uses tenant name and auth@atnd.me for platform subdomains', async () => {
    const findImpl = vi.fn(async ({ collection, where }: any) => {
      expect(collection).toBe('tenants')
      expect(where).toEqual({ slug: { equals: 'acme' } })
      return { docs: [{ name: 'Acme Gym', domain: null }] }
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
    expect(payload.subject).toBe('Sign in to Acme Gym')
    expect(payload.from).toBe('Acme Gym <auth@atnd.me>')
  })
})

