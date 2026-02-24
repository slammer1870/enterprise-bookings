import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import { normalizeCustomDomain } from '@/utilities/validateCustomDomain'

/**
 * Resolves tenant slug by hostname (custom domain).
 * Used by middleware when the request host is not a platform subdomain.
 * GET /api/tenant-by-host?host=studio.example.com → { slug: 'acme' } or 404.
 */
export async function GET(request: NextRequest) {
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

    return NextResponse.json({ slug: tenant.slug as string })
  } catch (err) {
    console.error('[api/tenant-by-host]', err)
    return NextResponse.json(
      { error: 'Failed to resolve tenant' },
      { status: 500 }
    )
  }
}
