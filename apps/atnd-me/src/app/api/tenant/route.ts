import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

import { getPayload } from '@/lib/payload'

/**
 * API route to resolve tenant slug to tenant ID
 * Called from server components to get tenant context
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const tenantSlug = cookieStore.get('tenant-slug')?.value || 
                      request.headers.get('x-tenant-slug') ||
                      request.nextUrl.searchParams.get('slug')

    if (!tenantSlug) {
      return NextResponse.json({ error: 'No tenant slug provided' }, { status: 400 })
    }

    const payload = await getPayload()

    const tenantResult = await payload.find({
      collection: 'tenants',
      where: {
        slug: {
          equals: tenantSlug,
        },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true, // Allow public lookup
    })

    const tenant = tenantResult.docs[0]

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
    })
  } catch (error) {
    console.error('Error resolving tenant:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
