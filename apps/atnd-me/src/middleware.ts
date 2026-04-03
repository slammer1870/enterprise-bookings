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

  const clearTenantContextCookies = (response: NextResponse) => {
    clearCookieEverywhere({
      response,
      name: 'tenant-slug',
      paths: ['/', '/admin', '/admin/'],
      domains: [undefined, rootHostname ? `.${rootHostname}` : undefined],
    })
    clearCookieEverywhere({
      response,
      name: PAYLOAD_TENANT_COOKIE,
      paths: ['/', '/admin', '/admin/'],
      domains: [undefined, rootHostname ? `.${rootHostname}` : undefined],
    })
    clearCookieEverywhere({
      response,
      name: 'tenant-id',
      paths: ['/', '/admin', '/admin/'],
      domains: [undefined, rootHostname ? `.${rootHostname}` : undefined],
    })
  }

  // Skip middleware for static/API paths (admin is handled below so we can set tenant cookie from subdomain).
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/sitemap') ||
    pathname.startsWith('/robots.txt')
  ) {
    // Never mutate tenant cookies for API/static requests. Follow-up admin requests can lack a
    // reliable Referer header, and clearing here wipes the sidebar tenant selection after route
    // changes. Stale cookie cleanup is handled on real frontend page requests below.
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
      clearTenantContextCookies(response)
    }
    // Enforce tenant-admin tenant isolation in admin UI (root domain = no tenant).
    if (isPayloadAdmin) {
      const authCheck = await enforceAdminTenantAuthorization({
        request,
        response,
        rootHostname,
        platformOrigin,
      })
      if (authCheck) return authCheck
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
    // Ensure there is only one tenant-slug cookie stored (no duplicates across path/domain).
    // Canonical cookie: Path=/, Domain=(host-only for custom domain/localhost) or .rootHostname for platform subdomains.
    const domainScoped =
      !isCustomDomain && !isLocalhost
        ? cookieOptions.domain
        : undefined
    clearCookieEverywhere({
      response,
      name: 'tenant-slug',
      paths: ['/', '/admin', '/admin/'],
      domains: [undefined, domainScoped],
    })
    response.cookies.set('tenant-slug', subdomain, cookieOptions)
  }

  // Important: keep Payload's multi-tenant context cookie (`payload-tenant`) in sync on tenant sites.
  //
  // Previously, we only set this cookie for `/admin` routes. That can break public endpoints that
  // depend on tenant scoping (e.g. POST /api/form-submissions from the frontend), because the
  // collection-level tenant scoping logic may look for this cookie on API requests.
  const existingPayloadTenant = request.cookies.get(PAYLOAD_TENANT_COOKIE)?.value
  const shouldResyncPayloadTenant =
    existingTenantSlug !== subdomain &&
    existingTenantSlug != null &&
    existingTenantSlug !== ''

  if (
    ((existingPayloadTenant == null || existingPayloadTenant === '') || shouldResyncPayloadTenant) &&
    subdomain &&
    /^[a-z0-9-]+$/i.test(subdomain)
  ) {
    let tenantIdToSet: string | number | null = resolvedTenantId

    // For platform subdomains (or when custom domain didn't already resolve an ID), look up tenant id.
    if (tenantIdToSet == null) {
      try {
        const origin = platformOrigin ?? request.nextUrl.origin
        const url = `${origin}/api/tenant-by-slug?slug=${encodeURIComponent(subdomain)}`
        const res = await fetch(url, { cache: 'no-store', headers: internalResolveHeaders })
        if (res.ok) {
          const data = (await res.json()) as { id?: string | number }
          tenantIdToSet = typeof data?.id === 'string' || typeof data?.id === 'number' ? data.id : null
        }
      } catch {
        // Leave payload-tenant unset on fetch error
      }
    }

    if (tenantIdToSet != null && tenantIdToSet !== '') {
      // Ensure there is only one payload-tenant cookie stored (no duplicates across path/domain).
      // Canonical cookie: Path=/, Domain=(host-only for custom domain/localhost) or .rootHostname for platform subdomains.
      const domainScoped =
        !isCustomDomain && !isLocalhost
          ? cookieOptions.domain
          : undefined
      clearCookieEverywhere({
        response,
        name: PAYLOAD_TENANT_COOKIE,
        paths: ['/', '/admin', '/admin/'],
        domains: [undefined, domainScoped],
      })
      response.cookies.set(PAYLOAD_TENANT_COOKIE, String(tenantIdToSet), cookieOptions)
    }
  }

  // Enforce tenant-admin tenant isolation in admin UI.
  if (isPayloadAdmin) {
    const authCheck = await enforceAdminTenantAuthorization({
      request,
      response,
      rootHostname,
      platformOrigin,
    })
    if (authCheck) return authCheck
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

type EnforceArgs = {
  request: NextRequest
  response: NextResponse
  rootHostname: string | null
  platformOrigin: string | null
}

function resolveLoginRouteRedirect(args: {
  request: NextRequest
  response: NextResponse
  isLoginRoute: boolean
  authStatus: number
}): NextResponse | null {
  const { request, response, isLoginRoute, authStatus } = args
  if (!isLoginRoute) return null
  if (authStatus === 401) return null
  if (authStatus === 403) return null

  // Authenticated users should not remain on /admin/login; keep host context.
  const adminUrl = request.nextUrl.clone()
  adminUrl.pathname = '/admin'
  adminUrl.search = ''
  const redirectResponse = NextResponse.redirect(adminUrl)
  copySetCookieHeaders(response, redirectResponse)
  return redirectResponse
}

function clearCookieHeader(name: string, path: string, domain?: string | null): string {
  const domainAttr = domain ? `; Domain=${domain}` : ''
  return `${name}=; Path=${path}; Max-Age=0; SameSite=Lax${domainAttr}`
}

function clearCookieEverywhere(args: {
  response: NextResponse
  name: string
  /**
   * Include all paths that might have been used historically/by dependencies.
   * Browsers treat cookies with same name but different path as distinct entries.
   */
  paths: string[]
  /**
   * Include both host-only (undefined) and any known domain-scoped variants.
   * Browsers treat cookies with same name but different domain as distinct entries.
   */
  domains: Array<string | null | undefined>
}) {
  const { response, name, paths, domains } = args
  for (const path of paths) {
    for (const domain of domains) {
      response.headers.append('Set-Cookie', clearCookieHeader(name, path, domain ?? undefined))
    }
  }
}

function copySetCookieHeaders(source: NextResponse, target: NextResponse) {
  const getSetCookie = (source.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
  const setCookies = typeof getSetCookie === 'function'
    ? getSetCookie.call(source.headers)
    : []

  if (setCookies.length > 0) {
    for (const cookie of setCookies) {
      target.headers.append('Set-Cookie', cookie)
    }
    return
  }

  const setCookieHeader = source.headers.get('set-cookie')
  if (setCookieHeader) {
    target.headers.append('Set-Cookie', setCookieHeader)
  }
}

async function enforceAdminTenantAuthorization(args: EnforceArgs): Promise<NextResponse | null> {
  const { request, response, rootHostname, platformOrigin } = args

  const { pathname } = request.nextUrl
  const isLoginRoute = pathname === '/admin/login' || pathname.startsWith('/admin/login/')

  const origin = platformOrigin ?? request.nextUrl.origin
  const url = `${origin}/api/admin/authorize-tenant`

  let res: Response
  try {
    res = await fetch(url, {
      cache: 'no-store',
      headers: request.headers,
    })
  } catch {
    // If the check fails (network/runtime), fail open so admin isn't bricked.
    return null
  }

  const loginRouteRedirect = resolveLoginRouteRedirect({
    request,
    response,
    isLoginRoute,
    authStatus: res.status,
  })
  if (loginRouteRedirect) return loginRouteRedirect

  if (res.status === 401) {
    if (isLoginRoute) return null
    // Keep unauthenticated admin access on the current host (tenant/custom domain).
    // Without this explicit redirect, Payload may resolve login via platform root URL.
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/admin/login'
    loginUrl.search = ''
    const redirectResponse = NextResponse.redirect(loginUrl)
    copySetCookieHeaders(response, redirectResponse)
    return redirectResponse
  }

  if (res.status !== 403) return null

  // Forbidden: clear tenant cookies and send user to platform root admin.
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = '/admin'
  redirectUrl.search = ''

  if (rootHostname) {
    redirectUrl.hostname = rootHostname
    // Preserve port for local dev.
    if (rootHostname.includes('localhost')) {
      redirectUrl.port = request.nextUrl.port || redirectUrl.port
    } else {
      redirectUrl.port = ''
    }
  }
  // Prevent loops (e.g. tenant-admin on root /admin with no tenant context):
  // if redirect target equals current URL, send to login on root host.
  if (redirectUrl.toString() === request.nextUrl.toString()) {
    redirectUrl.pathname = '/admin/login'
  }

  const redirectResponse = NextResponse.redirect(redirectUrl)

  // Clear both host-scoped and domain-scoped cookies.
  redirectResponse.headers.append('Set-Cookie', clearCookieHeader('payload-tenant', '/'))
  redirectResponse.headers.append('Set-Cookie', clearCookieHeader('payload-tenant', '/admin'))
  redirectResponse.headers.append('Set-Cookie', clearCookieHeader('payload-tenant', '/admin/'))
  redirectResponse.headers.append('Set-Cookie', clearCookieHeader('tenant-slug', '/'))
  redirectResponse.headers.append('Set-Cookie', clearCookieHeader('tenant-id', '/'))

  if (rootHostname && !rootHostname.includes('localhost')) {
    const domain = `.${rootHostname}`
    redirectResponse.headers.append('Set-Cookie', clearCookieHeader('payload-tenant', '/', domain))
    redirectResponse.headers.append('Set-Cookie', clearCookieHeader('payload-tenant', '/admin', domain))
    redirectResponse.headers.append('Set-Cookie', clearCookieHeader('payload-tenant', '/admin/', domain))
    redirectResponse.headers.append('Set-Cookie', clearCookieHeader('tenant-slug', '/', domain))
    redirectResponse.headers.append('Set-Cookie', clearCookieHeader('tenant-id', '/', domain))
  }

  return redirectResponse
}
