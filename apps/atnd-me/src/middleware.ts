import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { parseBranchSlugFromPathname } from '@/utilities/getLocationContext'
import { PAYLOAD_LOCATION_COOKIE, PUBLIC_BRANCH_SLUG_COOKIE } from '@/utilities/tenantRequest'
import { POST_LOGIN_REDIRECT_COOKIE } from '@/collections/Users/hooks/constants'

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

/**
 * Public hostname for the page (customer-facing). Prefer `x-forwarded-host` so reverse proxies
 * that set `Host` to an internal address still resolve the correct tenant / custom domain.
 */
function getPublicHostname(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || ''
  const host = request.headers.get('host')?.trim() || ''
  const raw = forwarded || host
  return (raw.split(':')[0] ?? raw).toLowerCase()
}

/**
 * Returns an AbortSignal that cancels hanging internal fetches after 2 seconds.
 * Only applied outside of production so that integration tests (which have no real
 * server to respond) fail fast instead of blocking the whole test run.
 * In production (e2e webServer or real deployment) we allow the server as much
 * time as it needs — killing the signal there would silently drop tenant context
 * on a momentarily-busy server, causing pages to render without the right tenant.
 */
function internalFetchSignal(): AbortSignal | undefined {
  return process.env.NODE_ENV !== 'production' ? AbortSignal.timeout(2000) : undefined
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPayloadAdmin = pathname.startsWith('/admin')
  const hostname = getPublicHostname(request)
  const isLocalhost = hostname.includes('localhost')
  const rootHostname = getRootHostname()?.toLowerCase() ?? null
  const platformOrigin = getPlatformOrigin()

  const clearTenantContextCookies = (response: NextResponse) => {
    clearCookieEverywhere({
      response,
      name: 'tenant-slug',
      paths: ['/', '/admin', '/admin/', '/admin/collections', '/admin/collections/'],
      domains: [undefined, rootHostname ? `.${rootHostname}` : undefined],
    })
    clearCookieEverywhere({
      response,
      name: PAYLOAD_TENANT_COOKIE,
      paths: ['/', '/admin', '/admin/', '/admin/collections', '/admin/collections/'],
      domains: [undefined, rootHostname ? `.${rootHostname}` : undefined],
    })
    clearCookieEverywhere({
      response,
      name: 'tenant-id',
      paths: ['/', '/admin', '/admin/', '/admin/collections', '/admin/collections/'],
      domains: [undefined, rootHostname ? `.${rootHostname}` : undefined],
    })
    clearCookieEverywhere({
      response,
      name: PUBLIC_BRANCH_SLUG_COOKIE,
      paths: ['/', '/admin', '/admin/', '/admin/collections', '/admin/collections/'],
      domains: [undefined, rootHostname ? `.${rootHostname}` : undefined],
    })
    clearCookieEverywhere({
      response,
      name: PAYLOAD_LOCATION_COOKIE,
      paths: ['/', '/admin', '/admin/', '/admin/collections', '/admin/collections/'],
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

  // Post-login redirect: afterLogin hook sets this cookie once after login to signal where the
  // browser should land. Consume it here (fires on the /admin navigation that follows login)
  // and redirect immediately — before any tenant cookie logic runs.
  if (isPayloadAdmin && rootHostname) {
    const postLoginRedirect = request.cookies.get(POST_LOGIN_REDIRECT_COOKIE)?.value?.trim()
    if (postLoginRedirect) {
      const clearCookie = `${POST_LOGIN_REDIRECT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`

      if (postLoginRedirect === 'base') {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/admin/login'
        redirectUrl.search = ''
        redirectUrl.hostname = rootHostname
        if (rootHostname.includes('localhost')) {
          redirectUrl.port = request.nextUrl.port || redirectUrl.port
        } else {
          redirectUrl.port = ''
        }
        const res = NextResponse.redirect(redirectUrl)
        res.headers.append('Set-Cookie', clearCookie)
        return res
      }

      if (postLoginRedirect.startsWith('tenant:')) {
        const slug = postLoginRedirect.slice('tenant:'.length).trim()
        if (slug) {
          const redirectUrl = request.nextUrl.clone()
          redirectUrl.pathname = '/admin'
          redirectUrl.search = ''
          if (rootHostname.includes('localhost')) {
            redirectUrl.hostname = `${slug}.localhost`
            redirectUrl.port = request.nextUrl.port || redirectUrl.port
          } else {
            redirectUrl.hostname = `${slug}.${rootHostname}`
            redirectUrl.port = ''
          }
          const res = NextResponse.redirect(redirectUrl)
          res.headers.append('Set-Cookie', clearCookie)
          return res
        }
      }
    }
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

  // Apex → www redirect: when hitting the bare platform domain on a public-facing path, redirect
  // to the www subdomain so the landing-page tenant ("www") handles the request.
  // Excluded: /admin (super-admin global context), /auth (auth UI), /next (preview/seed routes).
  // API routes are already excluded above. Skipped entirely in localhost dev.
  const isApexPublicPath =
    !isPayloadAdmin &&
    !pathname.startsWith('/auth') &&
    !pathname.startsWith('/next')
  if (!isLocalhost && rootHostname && hostname === rootHostname && isApexPublicPath) {
    const target = new URL(request.nextUrl.href)
    target.hostname = `www.${rootHostname}`
    // Strip internal port when behind an HTTPS reverse proxy (Traefik/Coolify).
    if (target.protocol === 'https:' && target.port === '3000') target.port = ''
    return NextResponse.redirect(target.toString(), 301)
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
    // Resolve host → tenant via /api/tenant-by-host on every navigation so cookies stay aligned
    // with the public Host (stale `tenant-slug` would otherwise win on the first paint).
    const slugFromCookie = request.cookies.get('tenant-slug')?.value?.trim()
    const payloadTenantRaw = request.cookies.get(PAYLOAD_TENANT_COOKIE)?.value?.trim()
    const slugLooksValid = Boolean(slugFromCookie && /^[a-z0-9-]+$/i.test(slugFromCookie))
    const idFromCookie =
      payloadTenantRaw && /^\d+$/.test(payloadTenantRaw) ? parseInt(payloadTenantRaw, 10) : null

    // Always resolve custom domain from the public Host first. `tenant-slug` may be stale
    // (e.g. another tenant from a prior session or platform subdomain cookie copied incorrectly).
    let resolvedFromHost: { slug: string; id: string | number } | null = null
    try {
      const origin = platformOrigin ?? request.nextUrl.origin
      const url = `${origin}/api/tenant-by-host?host=${encodeURIComponent(hostname)}`
      const signal = internalFetchSignal()
      const res = await fetch(url, {
        cache: 'no-store',
        // Pass hostname in a header as well: Next.js normalises 127.0.0.1→localhost
        // in URL query strings during internal routing, so the header is the
        // authoritative source of the original hostname.
        headers: { ...internalResolveHeaders, 'x-resolve-host': hostname },
        ...(signal && { signal }),
      })
      if (res.ok) {
        const data = (await res.json()) as { slug?: string; id?: string | number; redirectTo?: string }
        // Apex domain: redirect to the www custom domain before any cookie logic
        if (data?.redirectTo && typeof data.redirectTo === 'string') {
          // console.log(`[middleware] apex redirect ${hostname} → ${data.redirectTo}`)
          // Preserve the current request's protocol and port so that local/test
          // environments (http://...:3000) work correctly.  In production, the
          // app runs behind a reverse proxy (Traefik) on an internal port (3000)
          // that must NOT appear in the public redirect URL — strip it when the
          // protocol is HTTPS (proxy scenario) so the redirect lands on the
          // standard port. HTTP requests keep their port (local/E2E dev).
          const redirectUrl = new URL(data.redirectTo)
          const target = new URL(request.nextUrl.href)
          target.hostname = redirectUrl.hostname
          if (target.protocol === 'https:' && target.port === '3000') {
            target.port = ''
          }
          target.pathname = pathname
          target.search = request.nextUrl.search
          return NextResponse.redirect(target.toString(), 301)
        }
        if (data?.slug && typeof data.slug === 'string') {
          resolvedFromHost = { slug: data.slug, id: data.id as string | number }
        }
      }
    } catch {
      // Fall through to cookie-only path
    }

    if (resolvedFromHost) {
      subdomain = resolvedFromHost.slug
      isCustomDomain = true
      resolvedTenantId =
        typeof resolvedFromHost.id === 'string' || typeof resolvedFromHost.id === 'number'
          ? resolvedFromHost.id
          : null
    } else if (slugLooksValid && slugFromCookie) {
      subdomain = slugFromCookie
      isCustomDomain = true
      resolvedTenantId =
        idFromCookie !== null && Number.isFinite(idFromCookie) ? idFromCookie : null
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
    return response
  }

  const tenantRootRewriteUrl =
    pathname === '/'
      ? (() => {
          const rewriteUrl = request.nextUrl.clone()
          rewriteUrl.pathname = '/home'
          return rewriteUrl
        })()
      : null

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
    : tenantRootRewriteUrl
      ? NextResponse.rewrite(tenantRootRewriteUrl)
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
      paths: ['/', '/admin', '/admin/', '/admin/collections', '/admin/collections/'],
      domains: [undefined, domainScoped],
    })
    clearCookieEverywhere({
      response,
      name: PUBLIC_BRANCH_SLUG_COOKIE,
      paths: ['/', '/admin', '/admin/', '/admin/collections', '/admin/collections/'],
      domains: [undefined, domainScoped],
    })
    clearCookieEverywhere({
      response,
      name: PAYLOAD_LOCATION_COOKIE,
      paths: ['/', '/admin', '/admin/', '/admin/collections', '/admin/collections/'],
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

    // Blocking slug→id lookup: only when we need payload-tenant immediately.
    // Public frontend SSR resolves tenant via tenant-slug; skipping this fetch on cold
    // Lighthouse/first visits removes a full origin round-trip from TTFB.
    // Admin still looks up so the TenantSelector cookie is set on first paint.
    if (tenantIdToSet == null && isPayloadAdmin) {
      try {
        const origin = platformOrigin ?? request.nextUrl.origin
        const url = `${origin}/api/tenant-by-slug?slug=${encodeURIComponent(subdomain)}`
        const signal = internalFetchSignal()
        const res = await fetch(url, {
          cache: 'no-store',
          headers: internalResolveHeaders,
          ...(signal && { signal }),
        })
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
        paths: ['/', '/admin', '/admin/', '/admin/collections', '/admin/collections/'],
        domains: [undefined, domainScoped],
      })
      clearCookieEverywhere({
        response,
        name: PAYLOAD_LOCATION_COOKIE,
        paths: ['/', '/admin', '/admin/', '/admin/collections', '/admin/collections/'],
        domains: [undefined, domainScoped],
      })
      response.cookies.set(PAYLOAD_TENANT_COOKIE, String(tenantIdToSet), cookieOptions)
    }
  }

  const branchSlugFromPath = parseBranchSlugFromPathname(pathname)
  if (!isPayloadAdmin && subdomain && branchSlugFromPath) {
    const existingBranch = request.cookies.get(PUBLIC_BRANCH_SLUG_COOKIE)?.value ?? ''
    if (existingBranch !== branchSlugFromPath) {
      const domainScopedBranch =
        !isCustomDomain && !isLocalhost ? cookieOptions.domain : undefined
      clearCookieEverywhere({
        response,
        name: PUBLIC_BRANCH_SLUG_COOKIE,
        paths: ['/', '/admin', '/admin/', '/admin/collections', '/admin/collections/'],
        domains: [undefined, domainScopedBranch],
      })
      response.cookies.set(PUBLIC_BRANCH_SLUG_COOKIE, branchSlugFromPath, cookieOptions)
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

