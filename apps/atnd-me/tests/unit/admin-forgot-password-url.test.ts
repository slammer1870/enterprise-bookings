import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Users } from '../../src/collections/Users'
import { resolveTrustedPasswordResetOrigin } from '../../src/utilities/resolveTrustedPasswordResetOrigin'

const ORIGINAL_ENV = { ...process.env }

function generateEmailHTML() {
  const fn =
    Users.auth && typeof Users.auth === 'object'
      ? Users.auth.forgotPassword?.generateEmailHTML
      : undefined
  expect(fn).toEqual(expect.any(Function))
  return fn!
}

describe('resolveTrustedPasswordResetOrigin', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://atnd-me.com'
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('falls back to platform for untrusted Host headers', async () => {
    const origin = await resolveTrustedPasswordResetOrigin({
      headers: new Headers({ host: 'evil.example' }),
      payload: { find: vi.fn(async () => ({ docs: [] })) },
    })
    expect(origin).toBe('https://atnd-me.com')
  })

  it('trusts platform subdomains without a DB lookup', async () => {
    const find = vi.fn(async () => ({ docs: [] }))
    const origin = await resolveTrustedPasswordResetOrigin({
      headers: new Headers({
        host: 'acme.atnd-me.com',
        'x-forwarded-proto': 'https',
      }),
      payload: { find },
    })
    expect(origin).toBe('https://acme.atnd-me.com')
    expect(find).not.toHaveBeenCalled()
  })

  it('trusts custom domains only when present on a tenant', async () => {
    const find = vi.fn(async () => ({ docs: [{ id: 1 }] }))
    const origin = await resolveTrustedPasswordResetOrigin({
      headers: new Headers({
        host: 'studio.example.com',
        'x-forwarded-proto': 'https',
      }),
      payload: { find },
    })
    expect(origin).toBe('https://studio.example.com')
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'tenants',
        where: { domain: { equals: 'studio.example.com' } },
      }),
    )
  })

  it('rejects unknown custom domains', async () => {
    const origin = await resolveTrustedPasswordResetOrigin({
      headers: new Headers({
        host: 'unknown.example.com',
        'x-forwarded-proto': 'https',
      }),
      payload: { find: vi.fn(async () => ({ docs: [] })) },
    })
    expect(origin).toBe('https://atnd-me.com')
  })
})

describe('Admin forgot-password reset URL', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://atnd-me.com'
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('uses platform URL for untrusted hosts', async () => {
    const html = await generateEmailHTML()({
      token: 'abc123',
      user: { email: 'admin@example.com' },
      req: {
        payload: {
          config: {
            routes: { admin: '/admin' },
            admin: { routes: { reset: '/reset' } },
          },
          find: vi.fn(async () => ({ docs: [] })),
        },
        headers: new Headers({ host: 'evil.example' }),
      } as any,
    })

    expect(html).toContain('https://atnd-me.com/admin/reset/abc123')
    expect(html).not.toContain('evil.example')
  })

  it('scopes the reset link to a trusted tenant subdomain', async () => {
    const html = await generateEmailHTML()({
      token: 'tok',
      user: { email: 'admin@example.com' },
      req: {
        payload: {
          config: {
            routes: { admin: '/admin' },
            admin: { routes: { reset: '/reset' } },
          },
          find: vi.fn(async () => ({ docs: [] })),
        },
        headers: new Headers({
          host: 'acme.atnd-me.com',
          'x-forwarded-proto': 'https',
        }),
      } as any,
    })

    expect(html).toContain('https://acme.atnd-me.com/admin/reset/tok')
  })
})
