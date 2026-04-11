import { getPayload } from '@/lib/payload'
import { getTenantContext } from '@/utilities/getTenantContext'
import type { Where } from 'payload'
import { draftMode } from 'next/headers'
import { cache } from 'react'

const DEFAULT_LIMIT = 12

export const queryPostsArchive = cache(
  async (opts?: { page?: number; limit?: number }) => {
    const page = opts?.page ?? 1
    const limit = opts?.limit ?? DEFAULT_LIMIT
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
      ...(tenantId != null ? { tenant: { equals: tenantId } } : { tenant: { equals: null } }),
    }

    return payload.find({
      collection: 'posts',
      draft,
      depth: 1,
      limit,
      page,
      pagination: true,
      overrideAccess,
      ...(req ? { req } : {}),
      where,
      sort: '-publishedAt',
      select: {
        title: true,
        slug: true,
        categories: true,
        meta: true,
      },
    })
  },
)
