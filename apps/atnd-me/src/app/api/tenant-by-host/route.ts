import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import { findTenantByHost } from '@/lib/tenantDbResolve'
import { normalizeCustomDomain } from '@/utilities/validateCustomDomain'

const INTERNAL_TENANT_RESOLVE_HEADER = 'x-internal-tenant-resolve'
/** Carries the exact public hostname from middleware so URL normalization (e.g. 127.0.0.1→localhost) cannot corrupt it. */
const HOST_HEADER = 'x-resolve-host'

function isInternalResolveAuthorized(request: NextRequest): boolean {
  const token = process.env.INTERNAL_TENANT_RESOLVE_TOKEN
  const header = request.headers.get(INTERNAL_TENANT_RESOLVE_HEADER)
  const isProd = process.env.NODE_ENV === 'production'
  // Security: in production, require the token to be set + match to prevent tenant enumeration.
  if (isProd) return Boolean(token && header && header === token)
  // In non-prod, allow if token is unset (local dev/tests), otherwise require it.
  if (!token) return true
  return Boolean(header && header === token)
}

/**
 * Resolves tenant slug by hostname (custom domain).
 * Used by middleware when the request host is not a platform subdomain.
 * GET /api/tenant-by-host?host=studio.example.com → { slug: 'acme', id: '...' } or 404.
 */
export async function GET(request: NextRequest) {
  const auth = isInternalResolveAuthorized(request)
  if (!auth) {
    return NextResponse.json(null, { status: 404 })
  }

  // Prefer the header over the query param: Next.js normalises 127.0.0.1→localhost
  // in query-string values when routing requests internally, which breaks lookups
  // for hostnames that embed IPv4 addresses (e.g. foo.127.0.0.1.nip.io).
  // The header is forwarded verbatim.
  const host = request.headers.get(HOST_HEADER) ?? request.nextUrl.searchParams.get('host')
  if (!host || typeof host !== 'string') {
    return NextResponse.json({ error: 'Missing host' }, { status: 400 })
  }

  const normalized = normalizeCustomDomain(host)
  if (!normalized) {
    return NextResponse.json({ error: 'Invalid host' }, { status: 400 })
  }

  try {
    const payload = await getPayload()
    const result = await findTenantByHost(payload, normalized)
    if (!result) {
      return NextResponse.json(null, { status: 404 })
    }

    if (result.type === 'apex') {
      return NextResponse.json({
        slug: result.slug,
        id: result.id,
        redirectTo: `https://${result.wwwDomain}`,
      })
    }

    return NextResponse.json({ slug: result.slug, id: result.id })
  } catch (err) {
    console.error('[api/tenant-by-host]', err)
    return NextResponse.json(
      { error: 'Failed to resolve tenant' },
      { status: 500 }
    )
  }
}
