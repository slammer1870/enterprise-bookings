import { getPayload } from '@/lib/payload'
import { getTenantContext } from '@/utilities/getTenantContext'
import type { Page } from '@/payload-types'
import type { Where } from 'payload'
import { draftMode } from 'next/headers'
import { cache } from 'react'

export const queryPageBySlug = cache(async ({ slug }: { slug: string }): Promise<Page | null> => {
  const { isEnabled: draft } = await draftMode()
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const payload = await getPayload()
  const tenant = await getTenantContext(payload, { cookies: cookieStore })
  const tenantId = tenant?.id ?? null

  // Build where clause:
  // - On tenant sites (tenant context exists): only return that tenant's page.
  // - On the base site (no tenant context): only return global pages (tenant is null).
  const where: Where = {
    slug: {
      equals: slug,
    },
    ...(tenantId ? { tenant: { equals: tenantId } } : { tenant: { equals: null } }),
  }

  const result = await payload.find({
    collection: 'pages',
    draft,
    depth: 2, // Populate media relations and nested references
    limit: 1,
    pagination: false,
    overrideAccess: draft,
    where,
  })

  return result.docs?.[0] || null
})

