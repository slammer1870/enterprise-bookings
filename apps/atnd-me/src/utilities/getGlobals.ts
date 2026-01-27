import { getPayload } from '@/lib/payload'
import { unstable_cache } from './next-cache'

// Loosely typed global slug until generated types include globals
type Global = string

async function getGlobal(slug: Global, depth = 0) {
  const payload = await getPayload()

  const global = await payload.findGlobal({
    slug: slug as any,
    depth,
  })

  return global
}

/**
 * Returns a unstable_cache function mapped with the cache tag for the slug
 */
export const getCachedGlobal = (slug: Global, depth = 0) =>
  unstable_cache(async () => getGlobal(slug, depth), [slug], {
    tags: [`global_${slug}`],
  })
