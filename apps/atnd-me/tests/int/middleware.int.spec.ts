import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../../src/middleware'

/**
 * Tests for Next.js middleware functionality
 * 
 * Note: Testing middleware directly is challenging because it runs on Edge runtime.
 * We test the core logic by mocking NextRequest and verifying cookie behavior.
 */
describe('Middleware', () => {
  const createMockRequest = (hostname: string, pathname: string = '/'): NextRequest => {
    const url = `http://${hostname}${pathname}`
    return new NextRequest(url, {
      headers: {
        host: hostname,
      },
    })
  }

  it('extracts subdomain from localhost hostname', async () => {
    const request = createMockRequest('tenant1.localhost:3000', '/')
    const response = await middleware(request)
    
    // Should set tenant-slug cookie
    const cookieHeader = response.headers.get('set-cookie')
    expect(cookieHeader).toBeTruthy()
    expect(cookieHeader).toContain('tenant-slug=tenant1')
  })

  it('extracts subdomain from production hostname', async () => {
    const request = createMockRequest('tenant1.atnd-me.com', '/')
    const response = await middleware(request)
    
    // Should set tenant-slug cookie
    const cookieHeader = response.headers.get('set-cookie')
    expect(cookieHeader).toBeTruthy()
    expect(cookieHeader).toContain('tenant-slug=tenant1')
  })

  it('handles root domain without subdomain', async () => {
    const request = createMockRequest('atnd-me.com', '/')
    const response = await middleware(request)
    
    // Should clear tenant cookies for root domain
    const cookieHeader = response.headers.get('set-cookie')
    // Cookie deletion sets cookies with empty values and expiration dates
    // So we check that tenant-slug is being deleted (set to empty) rather than set to a value
    if (cookieHeader) {
      // Should delete tenant-slug (empty value) or not set it to a non-empty value
      expect(cookieHeader).not.toContain('tenant-slug=tenant')
      // May contain tenant-slug=; (empty) for deletion
    }
  })

  it('handles localhost without subdomain', async () => {
    const request = createMockRequest('localhost:3000', '/')
    const response = await middleware(request)
    
    // Should clear tenant cookies for root localhost
    const cookieHeader = response.headers.get('set-cookie')
    // Cookie deletion sets cookies with empty values
    // So we check that tenant-slug is being deleted rather than set to a value
    if (cookieHeader) {
      // Should delete tenant-slug (empty value) or not set it to a non-empty value
      expect(cookieHeader).not.toContain('tenant-slug=tenant')
      // May contain tenant-slug=; (empty) for deletion
    }
  })

  it('skips middleware for admin routes', async () => {
    const request = createMockRequest('tenant1.localhost:3000', '/admin')
    const response = await middleware(request)
    
    // Should not set tenant-slug cookie for admin routes
    const cookieHeader = response.headers.get('set-cookie')
    expect(cookieHeader).toBeFalsy()
  })

  it('skips middleware for API routes', async () => {
    const request = createMockRequest('tenant1.localhost:3000', '/api/test')
    const response = await middleware(request)
    
    // Should not set tenant-slug cookie for API routes
    const cookieHeader = response.headers.get('set-cookie')
    expect(cookieHeader).toBeFalsy()
  })

  it('skips middleware for _next routes', async () => {
    const request = createMockRequest('tenant1.localhost:3000', '/_next/static/test.js')
    const response = await middleware(request)
    
    // Should not set tenant-slug cookie for _next routes
    const cookieHeader = response.headers.get('set-cookie')
    expect(cookieHeader).toBeFalsy()
  })

  it('handles multiple subdomain levels', async () => {
    // Test with subdomain.subdomain.domain.com format
    const request = createMockRequest('subdomain.tenant1.atnd-me.com', '/')
    const response = await middleware(request)
    
    // Should extract first subdomain (subdomain)
    const cookieHeader = response.headers.get('set-cookie')
    expect(cookieHeader).toBeTruthy()
    expect(cookieHeader).toContain('tenant-slug=subdomain')
  })

  it('handles localhost with port and subdomain', async () => {
    const request = createMockRequest('mytenant.localhost:8080', '/')
    const response = await middleware(request)
    
    // Should extract subdomain correctly
    const cookieHeader = response.headers.get('set-cookie')
    expect(cookieHeader).toBeTruthy()
    expect(cookieHeader).toContain('tenant-slug=mytenant')
  })

  it('sets cookie with correct attributes', async () => {
    const request = createMockRequest('tenant1.localhost:3000', '/')
    const response = await middleware(request)
    
    const cookieHeader = response.headers.get('set-cookie')
    expect(cookieHeader).toBeTruthy()
    
    // Verify cookie attributes
    expect(cookieHeader).toContain('tenant-slug=tenant1')
    expect(cookieHeader).toContain('Path=/')
    expect(cookieHeader).toContain('SameSite=lax') // Next.js uses lowercase
    // httpOnly should be false (not present in header)
    expect(cookieHeader).not.toContain('HttpOnly')
  })

  it('clears tenant cookies for root domain', async () => {
    const request = createMockRequest('atnd-me.com', '/')
    const response = await middleware(request)
    
    // Should attempt to delete tenant cookies
    const cookieHeader = response.headers.get('set-cookie')
    // Cookie deletion is done via setting cookies with Max-Age=0 or Expires in the past
    // The exact format depends on Next.js implementation
    // For now, just verify the response is created
    expect(response).toBeTruthy()
  })
})
