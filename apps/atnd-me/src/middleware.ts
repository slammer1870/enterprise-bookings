import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware to detect tenant from subdomain and set tenant context
 * 
 * Note: This middleware runs on Edge runtime and cannot use Node.js modules directly.
 * Tenant lookup is done via API route/server components to avoid bundling issues.
 * 
 * Flow:
 * - Root domain (atnd-me.com): Allow through (shows marketing page)
 * - Subdomain (tenant1.atnd-me.com): Extract subdomain, set tenant-slug cookie
 * - Admin routes: Skip tenant detection
 * - API routes: Set tenant context for Payload API
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') || ''
  
  // Skip middleware for admin routes, API routes, and static files
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/sitemap') ||
    pathname.startsWith('/robots.txt')
  ) {
    return NextResponse.next()
  }

  // Extract subdomain from hostname
  // Format: subdomain.domain.com or subdomain.localhost:3000
  const parts = hostname.split('.')
  const isLocalhost = hostname.includes('localhost')
  
  let subdomain: string | null = null
  
  if (isLocalhost) {
    // For localhost: subdomain.localhost:3000
    const localhostParts = hostname.split(':')
    const hostWithoutPort = localhostParts[0]
    if (hostWithoutPort) {
      const hostParts = hostWithoutPort.split('.')
      if (hostParts.length > 1 && hostParts[0] && hostParts[0] !== 'localhost') {
        subdomain = hostParts[0]
      }
    }
  } else {
    // For production: subdomain.domain.com
    // Assume domain has at least 2 parts (e.g., atnd-me.com)
    // If hostname has 3+ parts, first part is subdomain
    if (parts.length >= 3 && parts[0]) {
      subdomain = parts[0]
    }
  }

  // Root domain - no tenant context needed (shows marketing page)
  if (!subdomain) {
    // Clear any existing tenant cookies
    const response = NextResponse.next()
    response.cookies.delete('tenant-id')
    response.cookies.delete('tenant-slug')
    return response
  }

  // Set subdomain in cookies - tenant lookup will happen in API routes/server components
  // This avoids needing Payload in middleware (Edge runtime limitation)
  const response = NextResponse.next()
  response.cookies.set('tenant-slug', subdomain, {
    httpOnly: false, // Allow client-side access
    sameSite: 'lax',
    path: '/',
  })
  
  // Note: tenant-id will be resolved in API routes/server components via Payload
  // This keeps middleware lightweight and Edge-compatible

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
