import { expect } from '@playwright/test'
import { getPayloadInstance } from './data-helpers'

/**
 * Store only the www hostname. The apex is not in the list, so a request there
 * is not a redirect to www.
 */
export async function enableApexRedirect(slug: string, apexHost: string): Promise<void> {
  const payload = await getPayloadInstance()
  const wwwHost = apexHost.startsWith('www.') ? apexHost : `www.${apexHost}`
  await payload.update({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    data: { hostnames: [wwwHost], direction: 'allow-www-and-non-www' },
    overrideAccess: true,
  })

  await expect
    .poll(
      async () => {
        const result = await payload.find({
          collection: 'tenants',
          where: { slug: { equals: slug } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        const hostnames = result.docs[0]?.hostnames
        return Array.isArray(hostnames) ? hostnames : []
      },
      { timeout: 15_000 },
    )
    .toEqual([wwwHost])
}
