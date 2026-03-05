import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

describe('Magic-link URL scoping', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: 'development', RESEND_API_KEY: 'test' }
    delete process.env.CI
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.restoreAllMocks()
  })

  it('scopes the emailed verify link to callbackURL origin when callbackURL is absolute', async () => {
    vi.resetModules()
    const fetchMock = vi.fn(async (_url: string, _init?: any) => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '',
    }))
    vi.stubGlobal('fetch', fetchMock)

    const seenUrls: string[] = []

    const { createBetterAuthOptions } = await import('@repo/better-auth-config/server')

    const opts: any = createBetterAuthOptions({
      appName: 'ATND ME',
      baseURL: 'https://atnd.me',
      trustedOrigins: ['https://atnd.me'],
      adminUserIds: ['1'],
      disableDefaultPayloadAuth: false,
      hidePluginCollections: true,
      enableMagicLink: true,
      includeMagicLinkOptionConfig: true,
      roles: {
        adminRoles: ['admin', 'tenant-admin'],
        defaultRole: 'user',
        defaultAdminRole: 'admin',
        roles: ['user', 'admin', 'tenant-admin'],
        allowedFields: ['name'],
      },
      resolveMagicLinkAppName: ({ url }) => {
        seenUrls.push(url)
        return null
      },
    })

    const verifyUrl =
      'https://atnd.me/api/auth/magic-link/verify?token=tok&callbackURL=' +
      encodeURIComponent('https://bru-grappling.atnd.me/auth/callback?redirectTo=%2F')

    await opts.magicLink.sendMagicLink({
      email: 'person@example.com',
      token: 'tok',
      url: verifyUrl,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [_url, init] = fetchMock.mock.calls[0] as any[]
    const payload = JSON.parse(init.body)

    expect(payload.subject).toBe('Sign in to ATND ME')
    expect(payload.html).toContain('https://bru-grappling.atnd.me/api/auth/magic-link/verify?')
    expect(payload.html).toContain('callbackURL=')
    expect(seenUrls[0]).toContain('https://bru-grappling.atnd.me/api/auth/magic-link/verify?')
  })
})

