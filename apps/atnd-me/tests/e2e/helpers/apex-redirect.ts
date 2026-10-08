import { expect } from '@playwright/test'
import { getPayloadInstance } from './data-helpers'

/** Turn on the existing apex redirect and wait until the derived apex is stored. */
export async function enableApexRedirect(slug: string, apexHost: string): Promise<void> {
  const payload = await getPayloadInstance()
  await payload.update({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    data: { redirectApex: true },
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
        return result.docs[0]?.apexDomain
      },
      { timeout: 15_000 },
    )
    .toBe(apexHost)
}
