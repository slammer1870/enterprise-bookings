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
      const req = new NextRequest('http://atnd-me.com/', {
        headers: {
          host: 'atnd-me.com',
          cookie: 'tenant-slug=acme; payload-tenant=7',
        },
      })
      const res = await middleware(req)
      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toContain('tenant-slug=; Path=/; Max-Age=0')
      expect(setCookie).toContain('payload-tenant=; Path=/; Max-Age=0')
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
    const originalFetch = globalThis.fetch

    beforeEach(() => {
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://atnd-me.com'
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('redirects unauthenticated tenant admin requests to same-host /admin/login', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

        if (String(url).includes('/api/tenant-by-slug') && String(url).includes('slug=croilan')) {
          return new Response(JSON.stringify({ id: 123 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }) as Response
        }

        if (String(url).includes('/api/admin/authorize-tenant')) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }) as Response
        }

        return new Response(null, { status: 404 })
      }

      const req = new NextRequest('http://croilan.atnd-me.com/admin/collections/pages', {
        headers: { host: 'croilan.atnd-me.com' },
      })

      const res = await middleware(req)
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toBe('http://croilan.atnd-me.com/admin/login')
    })

    it('redirects forbidden tenant-admin access to platform root admin', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

        if (String(url).includes('/api/tenant-by-slug') && String(url).includes('slug=croilan')) {
          return new Response(JSON.stringify({ id: 123 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }) as Response
        }

        if (String(url).includes('/api/admin/authorize-tenant')) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }) as Response
        }

        return new Response(null, { status: 404 })
      }

      const req = new NextRequest('http://croilan.atnd-me.com/admin/collections/pages', {
        headers: { host: 'croilan.atnd-me.com' },
      })

      const res = await middleware(req)
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toBe('http://atnd-me.com/admin')
    })

    it('keeps unauthenticated /admin/login on same host', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (String(url).includes('/api/admin/authorize-tenant')) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }) as Response
        }
        return new Response(null, { status: 404 })
      }

      const req = new NextRequest('http://croilan.atnd-me.com/admin/login', {
        headers: { host: 'croilan.atnd-me.com' },
      })

      const res = await middleware(req)
      expect(res.status).toBe(200)
      expect(res.headers.get('location')).toBeNull()
    })

    it('redirects authenticated /admin/login to same-host /admin', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (String(url).includes('/api/admin/authorize-tenant')) {
          return new Response(null, { status: 204 })
        }
        return new Response(null, { status: 404 })
      }

      const req = new NextRequest('http://croilan.atnd-me.com/admin/login', {
        headers: { host: 'croilan.atnd-me.com' },
      })

      const res = await middleware(req)
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toBe('http://croilan.atnd-me.com/admin')
    })

    it('on forbidden /admin/login clears tenant cookies and continues (no redirect loop to platform root)', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (String(url).includes('/api/admin/authorize-tenant')) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }) as Response
        }
        return new Response(null, { status: 404 })
      }

      const req = new NextRequest('http://croilan.atnd-me.com/admin/login', {
        headers: { host: 'croilan.atnd-me.com' },
      })

      const res = await middleware(req)
      expect(res.status).toBe(200)
      expect(res.headers.get('location')).toBeNull()
      const setCookie = res.headers.get('set-cookie') ?? ''
      expect(setCookie).toContain('payload-tenant=; Path=/; Max-Age=0')
      expect(setCookie).toContain('tenant-slug=; Path=/; Max-Age=0')
    })

    it('redirects forbidden root /admin to site home (not /admin/login) to avoid Payload client redirect loop', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

        if (String(url).includes('/api/admin/authorize-tenant')) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }) as Response
        }

        return new Response(null, { status: 404 })
      }

      const req = new NextRequest('http://atnd-me.com/admin', {
        headers: { host: 'atnd-me.com' },
      })

      const res = await middleware(req)
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toBe('http://atnd-me.com/')
    })

    it('redirects tenant subdomain /admin to platform root when tenant auth returns forbidden', async () => {
      globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

        if (String(url).includes('/api/tenant-by-slug') && String(url).includes('slug=croilan')) {
          return new Response(JSON.stringify({ id: 123 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }) as Response
        }

        if (String(url).includes('/api/admin/authorize-tenant')) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }) as Response
        }

        return new Response(null, { status: 404 })
      }

      const req = new NextRequest('http://croilan.atnd-me.com/admin', {
        headers: { host: 'croilan.atnd-me.com' },
      })

      const res = await middleware(req)
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toBe('http://atnd-me.com/admin')
    })
  })
})
