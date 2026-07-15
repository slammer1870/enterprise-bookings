import { getPayload } from '@/lib/payload'
import { getTenantContext } from '@/utilities/getTenantContext'
import type { Page } from '@/payload-types'
import type { Where } from 'payload'
import { cookies, draftMode, headers } from 'next/headers'
import { cache } from 'react'
import { unstable_cache } from '@/utilities/next-cache'

async function fetchPublishedPage(args: {
  slug: string
  tenantId: number | null
}): Promise<Page | null> {
  const payload = await getPayload()
  const overrideAccess = args.tenantId == null
  const req =
    args.tenantId != null
      ? ({
          payload,
          context: { tenant: args.tenantId },
        } as Parameters<(typeof payload)['find']>[0]['req'])
      : undefined

  const where: Where = {
    slug: { equals: args.slug },
    ...(args.tenantId != null
      ? { tenant: { equals: args.tenantId } }
      : { tenant: { equals: null } }),
  }

  const result = await payload.find({
    collection: 'pages',
    draft: false,
    depth: 2,
    limit: 1,
    pagination: false,
    overrideAccess,
    ...(req ? { req } : {}),
    where,
  })

  return (result.docs?.[0] as Page | undefined) ?? null
}

/**
 * Request-deduped page lookup. Published pages are cached across requests
 * (ISR-style via unstable_cache); drafts always bypass the cache.
 */
export const queryPageBySlug = cache(async ({ slug }: { slug: string }): Promise<Page | null> => {
  const { isEnabled: draft } = await draftMode()
  const cookieStore = await cookies()
  const headersList = await headers()
  const payload = await getPayload()
  const tenant = await getTenantContext(payload, { cookies: cookieStore, headers: headersList })
  const tenantId = tenant?.id ?? null

  if (draft) {
    const overrideAccess = true
    const req =
      tenantId != null
        ? ({
            payload,
            headers: headersList,
            context: { tenant: tenantId },
          } as Parameters<(typeof payload)['find']>[0]['req'])
        : undefined

    const where: Where = {
      slug: { equals: slug },
      ...(tenantId != null ? { tenant: { equals: tenantId } } : { tenant: { equals: null } }),
    }

    const result = await payload.find({
      collection: 'pages',
      draft: true,
      depth: 2,
      limit: 1,
      pagination: false,
      overrideAccess,
      ...(req ? { req } : {}),
      where,
    })

    return (result.docs?.[0] as Page | undefined) ?? null
  }

  const tenantKey = tenantId == null ? 'root' : String(tenantId)
  return unstable_cache(
    () => fetchPublishedPage({ slug, tenantId }),
    ['page-by-slug', tenantKey, slug],
    {
      revalidate: 60,
      tags: [`page_${tenantKey}_${slug}`, 'pages'],
    },
  )()
})
