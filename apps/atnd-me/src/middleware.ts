import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** Root hostname from NEXT_PUBLIC_SERVER_URL (e.g. atnd-me.com) for cookie domain and subdomain logic. */
function getRootHostname(): string | null {
  const url = process.env.NEXT_PUBLIC_SERVER_URL
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

/**
 * Middleware: detect tenant from subdomain, set tenant-slug cookie.
 * Root domain from NEXT_PUBLIC_SERVER_URL so *.atnd-me.com works on Coolify/custom domains.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostHeader = request.headers.get('host') || ''
  const hostname = hostHeader.split(':')[0] ?? hostHeader
  const isLocalhost = hostname.includes('localhost')
  const rootHostname = getRootHostname()

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

  const parts = hostname.split('.')
  let subdomain: string | null = null

  if (isLocalhost) {
    if (parts.length > 1 && parts[0] && parts[0] !== 'localhost') {
      subdomain = parts[0]
    }
  } else if (rootHostname) {
    if (hostname === rootHostname) {
      subdomain = null
    } else if (hostname.endsWith('.' + rootHostname)) {
      const prefix = hostname.slice(0, -(rootHostname.length + 1))
      subdomain = prefix.split('.')[0] || null
    }
  } else {
    if (parts.length >= 3 && parts[0]) {
      subdomain = parts[0]
    }
  }

  if (!subdomain) {
    const response = NextResponse.next()
    response.cookies.delete('tenant-id')
    response.cookies.delete('tenant-slug')
    return response
  }

  const response = NextResponse.next()
  const cookieOptions: { httpOnly: boolean; sameSite: 'lax'; path: string; domain?: string } = {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
  }
  if (!isLocalhost && rootHostname) {
    cookieOptions.domain = `.${rootHostname}`
  } else if (!isLocalhost) {
    cookieOptions.domain = `.${parts.slice(-2).join('.')}`
  }
  response.cookies.set('tenant-slug', subdomain, cookieOptions)
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
