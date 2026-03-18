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
/** When true, root layout will not render <html>/<body> so Payload's RootLayout can be the only document (avoids hydration error). */
const ADMIN_HEADER = 'x-next-payload-admin'
const PAYLOAD_TENANT_COOKIE = 'payload-tenant'
const INTERNAL_TENANT_RESOLVE_HEADER = 'x-internal-tenant-resolve'

function getPlatformOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SERVER_URL
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPayloadAdmin = pathname.startsWith('/admin')
  const hostHeader = request.headers.get('host') || ''
  const hostname = hostHeader.split(':')[0] ?? hostHeader
  const isLocalhost = hostname.includes('localhost')
  const rootHostname = getRootHostname()
  const platformOrigin = getPlatformOrigin()

  // Skip middleware for static/API paths (admin is handled below so we can set tenant cookie from subdomain).
  if (
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

  // Custom domain: host is not platform root and not a subdomain of it; resolve tenant by domain lookup.
  let isCustomDomain = false
  let resolvedTenantId: string | number | null = null
  const internalResolveToken = process.env.INTERNAL_TENANT_RESOLVE_TOKEN
  const internalResolveHeaders = internalResolveToken
    ? { [INTERNAL_TENANT_RESOLVE_HEADER]: internalResolveToken }
    : undefined
  if (
    !subdomain &&
    !isLocalhost &&
    rootHostname &&
    hostname !== rootHostname &&
    !hostname.endsWith('.' + rootHostname)
  ) {
    try {
      const origin = platformOrigin ?? request.nextUrl.origin
      const url = `${origin}/api/tenant-by-host?host=${encodeURIComponent(hostname)}`
      const res = await fetch(url, { cache: 'no-store', headers: internalResolveHeaders })
      if (res.ok) {
        const data = (await res.json()) as { slug?: string; id?: string | number }
        if (data?.slug && typeof data.slug === 'string') {
          subdomain = data.slug
          isCustomDomain = true
          resolvedTenantId =
            typeof data.id === 'string' || typeof data.id === 'number' ? data.id : null
        }
      }
    } catch {
      // Leave subdomain null on fetch error
    }
  }

  // When returning from Stripe (or other external redirect), cancel/success URLs may land on root
  // and lose tenant context. If ?tenant=slug is present, redirect to tenant subdomain so middleware
  // sets the cookie and the app has correct tenant context (fixes continuous redirect to home).
  const tenantParam = request.nextUrl.searchParams.get('tenant')
  if (!subdomain && tenantParam && /^[a-z0-9-]+$/i.test(tenantParam)) {
    const url = request.nextUrl.clone()
    url.searchParams.delete('tenant')
    url.hostname =
      isLocalhost ? `${tenantParam}.localhost` : `${tenantParam}.${rootHostname ?? hostname}`
    if (isLocalhost && (request.nextUrl.port || request.nextUrl.protocol === 'http:')) {
      url.port = request.nextUrl.port || '3000'
    }
    return NextResponse.redirect(url)
  }

  if (!subdomain) {
    const response = isPayloadAdmin
      ? NextResponse.next({
          request: {
            headers: (() => {
              const h = new Headers(request.headers)
              h.set(ADMIN_HEADER, '1')
              return h
            })(),
          },
        })
      : NextResponse.next()
    // Do not delete tenant cookies on /admin: every admin request was getting Set-Cookie delete
    // which caused the admin dashboard to constantly reload. Only clear on frontend routes.
    if (!pathname.startsWith('/admin')) {
      response.cookies.delete('tenant-id')
      response.cookies.delete('tenant-slug')
    }
    return response
  }

  const response = isPayloadAdmin
    ? NextResponse.next({
        request: {
          headers: (() => {
            const h = new Headers(request.headers)
            h.set(ADMIN_HEADER, '1')
            return h
          })(),
        },
      })
    : NextResponse.next()
  const cookieOptions: { httpOnly: boolean; sameSite: 'lax'; path: string; domain?: string } = {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
  }
  // Custom domain: do not set cookie domain so the cookie is scoped to the current host only.
  if (!isCustomDomain) {
    if (!isLocalhost && rootHostname) {
      cookieOptions.domain = `.${rootHostname}`
    } else if (!isLocalhost) {
      cookieOptions.domain = `.${parts.slice(-2).join('.')}`
    }
  }
  // Avoid sending Set-Cookie on every request. Payload admin makes frequent background requests
  // during editing; re-issuing cookies there can trigger route refreshes and clear form state.
  const existingTenantSlug = request.cookies.get('tenant-slug')?.value
  if (existingTenantSlug !== subdomain) {
    response.cookies.set('tenant-slug', subdomain, cookieOptions)
  }

  // Fix: deep-linking into Payload admin on custom domains can server-redirect back to /admin
  // if payload-tenant isn't set yet (server components can't rely on client-side cookie set).
  if (isPayloadAdmin) {
    const existingPayloadTenant = request.cookies.get(PAYLOAD_TENANT_COOKIE)?.value
    if (
      (existingPayloadTenant == null || existingPayloadTenant === '') &&
      subdomain &&
      /^[a-z0-9-]+$/i.test(subdomain)
    ) {
      let tenantIdToSet: string | number | null = resolvedTenantId
      if (tenantIdToSet == null) {
        try {
          const origin = platformOrigin ?? request.nextUrl.origin
          const url = `${origin}/api/tenant-by-slug?slug=${encodeURIComponent(subdomain)}`
          const res = await fetch(url, { cache: 'no-store', headers: internalResolveHeaders })
          if (res.ok) {
            const data = (await res.json()) as { id?: string | number }
            tenantIdToSet =
              typeof data?.id === 'string' || typeof data?.id === 'number' ? data.id : null
          }
        } catch {
          // Leave payload-tenant unset on fetch error
        }
      }

      if (tenantIdToSet != null && tenantIdToSet !== '') {
        response.cookies.set(PAYLOAD_TENANT_COOKIE, String(tenantIdToSet), cookieOptions)
      }
    }
  }
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
