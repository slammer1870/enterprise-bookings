import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import { normalizeCustomDomain } from '@/utilities/validateCustomDomain'

const INTERNAL_TENANT_RESOLVE_HEADER = 'x-internal-tenant-resolve'

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
  if (!isInternalResolveAuthorized(request)) {
    return NextResponse.json(null, { status: 404 })
  }

  const host = request.nextUrl.searchParams.get('host')
  if (!host || typeof host !== 'string') {
    return NextResponse.json({ error: 'Missing host' }, { status: 400 })
  }

  const normalized = normalizeCustomDomain(host)
  if (!normalized) {
    return NextResponse.json({ error: 'Invalid host' }, { status: 400 })
  }

  try {
    const payload = await getPayload()
    const result = await payload.find({
      collection: 'tenants',
      where: { domain: { equals: normalized } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const tenant = result.docs[0]
    if (!tenant || !tenant.slug) {
      return NextResponse.json(null, { status: 404 })
    }

    return NextResponse.json({ slug: tenant.slug as string, id: (tenant as { id?: unknown }).id })
  } catch (err) {
    console.error('[api/tenant-by-host]', err)
    return NextResponse.json(
      { error: 'Failed to resolve tenant' },
      { status: 500 }
    )
  }
}
