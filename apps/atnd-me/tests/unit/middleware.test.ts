import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../../src/middleware'
import { POST_LOGIN_REDIRECT_COOKIE } from '../../src/collections/Users/hooks/constants'

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

    it('redirects root domain to www subdomain (apex redirect)', async () => {
      const req = new NextRequest('http://atnd-me.com/', {
        headers: {
          host: 'atnd-me.com',
          cookie: 'tenant-slug=acme; payload-tenant=7',
        },
      })
      const res = await middleware(req)
      expect(res.status).toBe(301)
      expect(res.headers.get('location')).toBe('http://www.atnd-me.com/')
    })

    it('extracts tenant from subdomain when host ends with root hostname', async () => {
      const res = await middleware(createMockRequest('acme.atnd-me.com', '/'))
      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toBeTruthy()
      expect(setCookie).toContain('tenant-slug=acme')
    })

    it('rewrites tenant root requests to /home while keeping tenant cookies in sync', async () => {
      const res = await middleware(createMockRequest('acme.atnd-me.com', '/'))
      const setCookie = res.headers.get('set-cookie')

      expect(res.headers.get('x-middleware-rewrite')).toBe('http://acme.atnd-me.com/home')
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
      expect(res.headers.get('x-middleware-rewrite')).toBe('http://studio.example.com/home')
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

    it('calls tenant-by-host on custom domain even when tenant cookies are already set', async () => {
      let tenantByHostCalls = 0
      globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (String(url).includes('/api/tenant-by-host')) {
          tenantByHostCalls += 1
          return new Response(JSON.stringify({ slug: 'acme', id: 42 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }) as Response
        }
        return new Response(null, { status: 404 })
      }

      const req = new NextRequest('http://studio.example.com/', {
        headers: {
          host: 'studio.example.com',
          cookie: 'tenant-slug=acme; payload-tenant=42',
        },
      })

      const res = await middleware(req)
      expect(tenantByHostCalls).toBe(1)
      expect(res.headers.get('x-middleware-rewrite')).toBe('http://studio.example.com/home')
    })

    it('overwrites stale tenant-slug on custom domain when it does not match host resolution', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (String(url).includes('/api/tenant-by-host') && String(url).includes('host=studio.example.com')) {
          return new Response(JSON.stringify({ slug: 'acme', id: 42 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }) as Response
        }
        return new Response(null, { status: 404 })
      }

      const req = new NextRequest('http://studio.example.com/', {
        headers: {
          host: 'studio.example.com',
          cookie: 'tenant-slug=wrong-slug; payload-tenant=99',
        },
      })

      const res = await middleware(req)
      const setCookie = res.headers.get('set-cookie') ?? ''
      expect(setCookie).toContain('tenant-slug=acme')
      expect(setCookie).toContain('payload-tenant=42')
    })

    it('issues a 301 redirect when API returns redirectTo for an apex host', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (String(url).includes('/api/tenant-by-host') && String(url).includes('host=croilan.com')) {
          return new Response(
            JSON.stringify({ slug: 'croilan', id: 1, redirectTo: 'https://www.croilan.com' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ) as Response
        }
        return new Response(null, { status: 404 })
      }
      const res = await middleware(createMockRequest('croilan.com', '/'))
      expect(res.status).toBe(301)
      // Middleware preserves the request protocol; mock requests use http://.
      // In production all requests arrive over https:// so the redirect is https://.
      expect(res.headers.get('location')).toBe('http://www.croilan.com/')
    })

    it('preserves pathname in the apex redirect', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (String(url).includes('/api/tenant-by-host')) {
          return new Response(
            JSON.stringify({ slug: 'croilan', id: 1, redirectTo: 'https://www.croilan.com' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ) as Response
        }
        return new Response(null, { status: 404 })
      }
      const res = await middleware(createMockRequest('croilan.com', '/schedule'))
      expect(res.status).toBe(301)
      expect(res.headers.get('location')).toBe('http://www.croilan.com/schedule')
    })

    it('preserves query string in the apex redirect', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (String(url).includes('/api/tenant-by-host')) {
          return new Response(
            JSON.stringify({ slug: 'croilan', id: 1, redirectTo: 'https://www.croilan.com' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ) as Response
        }
        return new Response(null, { status: 404 })
      }
      const req = new NextRequest('http://croilan.com/?ref=google', {
        headers: { host: 'croilan.com' },
      })
      const res = await middleware(req)
      expect(res.status).toBe(301)
      expect(res.headers.get('location')).toBe('http://www.croilan.com/?ref=google')
    })

    it('does not set tenant cookies on an apex redirect response', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (String(url).includes('/api/tenant-by-host')) {
          return new Response(
            JSON.stringify({ slug: 'croilan', id: 1, redirectTo: 'https://www.croilan.com' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ) as Response
        }
        return new Response(null, { status: 404 })
      }
      const res = await middleware(createMockRequest('croilan.com', '/'))
      const setCookie = res.headers.get('set-cookie') ?? ''
      expect(setCookie).not.toMatch(/tenant-slug=[a-zA-Z0-9-]+/)
    })

    it('uses x-forwarded-host for custom domain tenant-by-host when Host is internal', async () => {
      let sawStudioHost = false
      globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (String(url).includes('host=studio.example.com')) {
          sawStudioHost = true
        }
        if (String(url).includes('/api/tenant-by-host') && String(url).includes('host=studio.example.com')) {
          return new Response(JSON.stringify({ slug: 'acme', id: 1 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }) as Response
        }
        return new Response(null, { status: 404 })
      }

      const req = new NextRequest('http://127.0.0.1:3000/', {
        headers: {
          host: '127.0.0.1:3000',
          'x-forwarded-host': 'studio.example.com',
        },
      })

      const res = await middleware(req)
      expect(sawStudioHost).toBe(true)
      expect(res.headers.get('x-middleware-rewrite') ?? '').toMatch(/\/home$/)
    })
  })

  describe('admin cookie synchronization', () => {
    const originalFetch = globalThis.fetch

    beforeEach(() => {
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://atnd-me.com'
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('resyncs payload-tenant when tenant-slug changes on admin route', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (String(url).includes('/api/tenant-by-slug') && String(url).includes('slug=acme')) {
          return new Response(JSON.stringify({ id: 42 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }) as Response
        }
        return new Response(null, { status: 404 })
      }

      const req = new NextRequest('http://acme.atnd-me.com/admin', {
        headers: {
          host: 'acme.atnd-me.com',
          cookie: 'tenant-slug=old-tenant; payload-tenant=7',
        },
      })

      const res = await middleware(req)
      const setCookie = res.headers.get('set-cookie')

      expect(setCookie).toContain('tenant-slug=acme')
      expect(setCookie).toContain('payload-tenant=42')
    })
  })

  describe('admin tenant auth redirects', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://atnd-me.com'
    })

    // --- POST_LOGIN_REDIRECT_COOKIE (cookie-based post-login redirect) ---
    // Cross-tenant redirects now happen once at login time (afterLogin hook) rather than on
    // every admin request. The hook sets a short-lived cookie; middleware consumes it here.

    it('redirects to base-domain /admin/login when POST_LOGIN_REDIRECT_COOKIE=base', async () => {
      const req = new NextRequest('http://croilan.atnd-me.com/admin', {
        headers: {
          host: 'croilan.atnd-me.com',
          cookie: `${POST_LOGIN_REDIRECT_COOKIE}=base`,
        },
      })
      const res = await middleware(req)
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toBe('http://atnd-me.com/admin/login')
      expect(res.headers.get('set-cookie')).toContain(`${POST_LOGIN_REDIRECT_COOKIE}=; Path=/; Max-Age=0`)
    })

    it('redirects to tenant subdomain /admin when POST_LOGIN_REDIRECT_COOKIE=tenant:<slug>', async () => {
      const req = new NextRequest('http://atnd-me.com/admin', {
        headers: {
          host: 'atnd-me.com',
          cookie: `${POST_LOGIN_REDIRECT_COOKIE}=tenant:croilan`,
        },
      })
      const res = await middleware(req)
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toBe('http://croilan.atnd-me.com/admin')
      expect(res.headers.get('set-cookie')).toContain(`${POST_LOGIN_REDIRECT_COOKIE}=; Path=/; Max-Age=0`)
    })

    it('does not redirect when POST_LOGIN_REDIRECT_COOKIE is absent', async () => {
      const req = new NextRequest('http://croilan.atnd-me.com/admin', {
        headers: { host: 'croilan.atnd-me.com' },
      })
      const res = await middleware(req)
      expect(res.status).toBe(200)
      expect(res.headers.get('location')).toBeNull()
    })

    it('does not redirect on non-admin paths even when POST_LOGIN_REDIRECT_COOKIE is set', async () => {
      const req = new NextRequest('http://croilan.atnd-me.com/', {
        headers: {
          host: 'croilan.atnd-me.com',
          cookie: `${POST_LOGIN_REDIRECT_COOKIE}=base`,
        },
      })
      const res = await middleware(req)
      // Non-admin path — redirect block is skipped entirely
      expect(res.headers.get('location')).not.toBe('http://atnd-me.com/admin/login')
    })

    it('does not redirect when NEXT_PUBLIC_SERVER_URL is not set', async () => {
      delete process.env.NEXT_PUBLIC_SERVER_URL
      const req = new NextRequest('http://croilan.atnd-me.com/admin', {
        headers: {
          host: 'croilan.atnd-me.com',
          cookie: `${POST_LOGIN_REDIRECT_COOKIE}=base`,
        },
      })
      const res = await middleware(req)
      // Without a rootHostname the redirect block is skipped
      expect(res.headers.get('location')).toBeNull()
    })

    // --- Retained: /admin/login must never be redirected back to /admin ---

    it('keeps unauthenticated /admin/login on same host', async () => {
      const req = new NextRequest('http://croilan.atnd-me.com/admin/login', {
        headers: { host: 'croilan.atnd-me.com' },
      })
      const res = await middleware(req)
      expect(res.status).toBe(200)
      expect(res.headers.get('location')).toBeNull()
    })

    it('does not redirect /admin/login when no redirect cookie is present', async () => {
      const req = new NextRequest('http://atnd-me.com/admin/login', {
        headers: { host: 'atnd-me.com' },
      })
      const res = await middleware(req)
      expect(res.headers.get('location')).toBeNull()
    })

    it('does not redirect /admin/login to /admin when Referer is /admin (breaks bounce loop)', async () => {
      const req = new NextRequest('http://atnd-me.com/admin/login', {
        headers: {
          host: 'atnd-me.com',
          referer: 'http://atnd-me.com/admin',
        },
      })
      const res = await middleware(req)
      // Referer is /admin — must not redirect again or a bounce loop occurs.
      expect(res.headers.get('location')).toBeNull()
    })
  })
})
