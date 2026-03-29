import type { Config } from 'src/payload-types'

import { getPayload } from '@/lib/payload'
import { getTenantContext } from '@/utilities/getTenantContext'
import { unstable_cache } from './next-cache'

type Collection = keyof Config['collections']

async function getDocument(collection: Collection, slug: string, depth = 0) {
  const payload = await getPayload()
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const tenant = await getTenantContext(payload, { cookies: cookieStore })
  const tenantId = tenant?.id ?? null
  const req =
    tenantId != null
      ? ({
          payload,
          context: { tenant: tenantId },
        } as Parameters<(typeof payload)['find']>[0]['req'])
      : undefined

  const page = await payload.find({
    collection,
    depth,
    ...(req ? { req } : {}),
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return page.docs[0]
}

/**
 * Returns a unstable_cache function mapped with the cache tag for the slug
 */
export const getCachedDocument = (collection: Collection, slug: string) =>
  unstable_cache(async () => getDocument(collection, slug), [collection, slug], {
    tags: [`${collection}_${slug}`],
  })
