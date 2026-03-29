import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

import { getPayload } from '@/lib/payload'
import { getTenantSlug, getTenantContext } from '@/utilities/getTenantContext'

/**
 * API route to resolve tenant slug to tenant ID
 * Called from server components to get tenant context
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const source = {
      cookies: cookieStore,
      headers: request.headers,
      searchParams: request.nextUrl.searchParams,
    }
    const slug = await getTenantSlug(source)
    if (!slug) {
      return NextResponse.json({ error: 'No tenant slug provided' }, { status: 400 })
    }

    const payload = await getPayload()
    const tenant = await getTenantContext(payload, source)
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
