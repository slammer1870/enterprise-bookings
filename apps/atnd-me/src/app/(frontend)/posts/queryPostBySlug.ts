import { getPayload } from '@/lib/payload'
import { getTenantContext } from '@/utilities/getTenantContext'
import type { Post } from '@/payload-types'
import type { Where } from 'payload'
import { draftMode } from 'next/headers'
import { cache } from 'react'

export const queryPostBySlug = cache(async ({ slug }: { slug: string }): Promise<Post | null> => {
  const { isEnabled: draft } = await draftMode()
  const { cookies, headers } = await import('next/headers')
  const cookieStore = await cookies()
  const headersList = await headers()
  const payload = await getPayload()
  const tenant = await getTenantContext(payload, { cookies: cookieStore, headers: headersList })
  const tenantId = tenant?.id ?? null

  const overrideAccess = draft || tenantId == null
  const req =
    tenantId != null
      ? ({
          payload,
          context: { tenant: tenantId },
        } as Parameters<(typeof payload)['find']>[0]['req'])
      : undefined

  const where: Where = {
    slug: { equals: slug },
    ...(tenantId != null ? { tenant: { equals: tenantId } } : { tenant: { equals: null } }),
  }

  const result = await payload.find({
    collection: 'posts',
    draft,
    depth: 2,
    limit: 1,
    pagination: false,
    overrideAccess,
    ...(req ? { req } : {}),
    where,
  })

  return result.docs?.[0] || null
})
