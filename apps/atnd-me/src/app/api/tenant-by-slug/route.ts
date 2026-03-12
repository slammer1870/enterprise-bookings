import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'

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
 * Resolves tenant ID by tenant slug.
 * Used by middleware so server-rendered Payload admin routes have `payload-tenant` set on first load.
 * GET /api/tenant-by-slug?slug=acme → { id: '...', slug: 'acme' } or 404.
 */
export async function GET(request: NextRequest) {
  if (!isInternalResolveAuthorized(request)) {
    return NextResponse.json(null, { status: 404 })
  }

  const slug = request.nextUrl.searchParams.get('slug')
  if (!slug || typeof slug !== 'string') {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 })
  }

  const normalized = slug.trim().toLowerCase()
  if (!/^[a-z0-9-]+$/.test(normalized)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  try {
    const payload = await getPayload()
    const result = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: normalized } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const tenant = result.docs[0] as { id?: unknown; slug?: unknown } | undefined
    if (!tenant || !tenant.id) {
      return NextResponse.json(null, { status: 404 })
    }

    return NextResponse.json({ id: tenant.id, slug: normalized })
  } catch (err) {
    console.error('[api/tenant-by-slug]', err)
    return NextResponse.json({ error: 'Failed to resolve tenant' }, { status: 500 })
  }
}

