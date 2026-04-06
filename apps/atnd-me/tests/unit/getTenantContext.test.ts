import { describe, it, expect, vi, afterEach } from 'vitest'
import { getTenantContext, getTenantSlug } from '../../src/utilities/getTenantContext'

/**
 * Step 3 - getTenantContext helper
 *
 * Tests for extracting tenant slug from request-like sources and resolving to tenant context.
 */
describe('getTenantSlug (slug extraction)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('extracts slug from cookies', async () => {
    const cookieStore = {
      get: (name: string) =>
        name === 'tenant-slug' ? { value: 'my-tenant' } : undefined,
    }
    const slug = await getTenantSlug({ cookies: cookieStore })
    expect(slug).toBe('my-tenant')
  })

  it('extracts slug from x-tenant-slug header when cookie is missing', async () => {
    const headers = new Headers()
    headers.set('x-tenant-slug', 'header-tenant')
    const slug = await getTenantSlug({
      cookies: { get: () => undefined },
      headers,
    })
    expect(slug).toBe('header-tenant')
  })

  it('prefers cookie over header when both are present', async () => {
    const cookieStore = {
      get: (name: string) =>
        name === 'tenant-slug' ? { value: 'cookie-tenant' } : undefined,
    }
    const headers = new Headers()
    headers.set('x-tenant-slug', 'header-tenant')
    const slug = await getTenantSlug({ cookies: cookieStore, headers })
    expect(slug).toBe('cookie-tenant')
  })

  it('extracts slug from searchParams when cookie and header are missing', async () => {
    const searchParams = new URLSearchParams()
    searchParams.set('slug', 'param-tenant')
    const slug = await getTenantSlug({
      cookies: { get: () => undefined },
      headers: new Headers(),
      searchParams,
    })
    expect(slug).toBe('param-tenant')
  })

  it('returns null when no source provides a slug', async () => {
    const slug = await getTenantSlug({
      cookies: { get: () => undefined },
      headers: new Headers(),
    })
    expect(slug).toBeNull()
  })

  it('handles async cookies (Next.js cookies())', async () => {
    const asyncCookies = async () => ({
      get: (name: string) =>
        name === 'tenant-slug' ? { value: 'async-tenant' } : undefined,
    })
    const slug = await getTenantSlug({
      cookies: await asyncCookies(),
    })
    expect(slug).toBe('async-tenant')
  })

  it('ignores payload-tenant fallback on the platform base host', async () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://atnd-preview.org')

    const payload = {
      findByID: vi.fn(),
    }

    const tenant = await getTenantContext(payload as never, {
      cookies: {
        get: (name: string) => (name === 'payload-tenant' ? { value: '42' } : undefined),
      },
      headers: new Headers({ host: 'atnd-preview.org' }),
    })

    expect(tenant).toBeNull()
    expect(payload.findByID).not.toHaveBeenCalled()
  })

  it('allows payload-tenant fallback when the request host is unavailable', async () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://atnd-preview.org')

    const payload = {
      findByID: vi.fn(async () => ({
        id: 42,
        slug: 'acme',
        name: 'Acme Gym',
        domain: null,
      })),
    }

    const tenant = await getTenantContext(payload as never, {
      cookies: {
        get: (name: string) => (name === 'payload-tenant' ? { value: '42' } : undefined),
      },
    })

    expect(tenant).toEqual({
      id: 42,
      slug: 'acme',
      name: 'Acme Gym',
      domain: null,
    })
    expect(payload.findByID).toHaveBeenCalledOnce()
  })
})
