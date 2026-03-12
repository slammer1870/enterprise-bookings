import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../../src/middleware'

/**
 * Unit tests for middleware (no DB). Covers subdomain extraction and cookie
 * behavior with and without NEXT_PUBLIC_SERVER_URL (Coolify / multi-tenancy).
 */
describe('Middleware', () => {
  const createMockRequest = (host: string, pathname = '/'): NextRequest =>
    new NextRequest(`http://${host}${pathname}`, {
      headers: { host },
    })

  const originalEnv = process.env.NEXT_PUBLIC_SERVER_URL

  afterEach(() => {
    process.env.NEXT_PUBLIC_SERVER_URL = originalEnv
  })

  describe('without NEXT_PUBLIC_SERVER_URL (fallback)', () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_SERVER_URL
    })

    it('extracts subdomain from localhost', async () => {
      const res = await middleware(createMockRequest('tenant1.localhost:3000', '/'))
      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toBeTruthy()
      expect(setCookie).toContain('tenant-slug=tenant1')
    })

    it('extracts subdomain from production hostname (3+ parts)', async () => {
      const res = await middleware(createMockRequest('tenant1.atnd-me.com', '/'))
      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toBeTruthy()
      expect(setCookie).toContain('tenant-slug=tenant1')
    })

    it('sets tenant cookie for admin (tenant context) and skips setting cookie for api', async () => {
      const adminRes = await middleware(createMockRequest('tenant1.localhost:3000', '/admin'))
      const apiRes = await middleware(createMockRequest('tenant1.localhost:3000', '/api/foo'))
      expect(adminRes.headers.get('set-cookie')).toContain('tenant-slug=tenant1')
      expect(apiRes.headers.get('set-cookie')).toBeFalsy()
    })
  })

  describe('with NEXT_PUBLIC_SERVER_URL (Coolify / subdomain multi-tenancy)', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://atnd-me.com'
    })

    it('treats root domain as no tenant and clears cookies', async () => {
      const res = await middleware(createMockRequest('atnd-me.com', '/'))
      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).not.toContain('tenant-slug=tenant')
      expect(setCookie).not.toContain('tenant-slug=atnd')
    })

    it('extracts tenant from subdomain when host ends with root hostname', async () => {
      const res = await middleware(createMockRequest('acme.atnd-me.com', '/'))
      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toBeTruthy()
      expect(setCookie).toContain('tenant-slug=acme')
    })

    it('sets cookie domain to root hostname so cookie works across subdomains', async () => {
      const res = await middleware(createMockRequest('studio-one.atnd-me.com', '/'))
      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toContain('tenant-slug=studio-one')
      expect(setCookie).toContain('Domain=.atnd-me.com')
    })

    it('ignores host that does not match root (no subdomain set)', async () => {
      // Middleware may attempt custom-domain lookup; mock fetch to avoid real network.
      const originalFetch = globalThis.fetch
      globalThis.fetch = async () => new Response(null, { status: 404 })
      try {
        const res = await middleware(createMockRequest('other-domain.com', '/'))
        const setCookie = res.headers.get('set-cookie')
        expect(setCookie).not.toContain('tenant-slug=other')
      } finally {
        globalThis.fetch = originalFetch
      }
    }, 10000)
  })

  describe('localhost with NEXT_PUBLIC_SERVER_URL', () => {
    it('still extracts subdomain from localhost (localhost logic is independent)', async () => {
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://atnd-me.com'
      const res = await middleware(createMockRequest('mytenant.localhost:3000', '/'))
      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toContain('tenant-slug=mytenant')
    })
  })

  describe('custom domain (tenant resolved by host lookup)', () => {
    const originalFetch = globalThis.fetch

    beforeEach(() => {
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://atnd-me.com'
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('sets tenant-slug from API when host is custom domain and API returns slug', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (String(url).includes('/api/tenant-by-host') && String(url).includes('host=studio.example.com')) {
          return new Response(JSON.stringify({ slug: 'acme' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }) as Response
        }
        return new Response(null, { status: 404 })
      }
      const res = await middleware(createMockRequest('studio.example.com', '/'))
      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toBeTruthy()
      expect(setCookie).toContain('tenant-slug=acme')
      // Custom domain: cookie must not be scoped to platform (no Domain=.atnd-me.com)
      expect(setCookie).not.toContain('Domain=.atnd-me.com')
    })

    it('does not set tenant cookie when host is custom domain but API returns 404', async () => {
      globalThis.fetch = async () => new Response(null, { status: 404 })
      const res = await middleware(createMockRequest('unknown.example.com', '/'))
      const setCookie = res.headers.get('set-cookie')
      // No tenant slug value: may send delete (tenant-slug=;) but must not set a slug value
      expect(setCookie).not.toMatch(/tenant-slug=[a-zA-Z0-9-]+/)
    })

    it('does not set tenant cookie when host is custom domain but API errors', async () => {
      globalThis.fetch = async () => new Response(null, { status: 500 })
      const res = await middleware(createMockRequest('studio.example.com', '/'))
      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).not.toMatch(/tenant-slug=[a-zA-Z0-9-]+/)
    })
  })
})
