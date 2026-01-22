import type { CollectionAfterChangeHook } from 'payload'

import { revalidateTag } from '../../../utilities/next-cache'

export const revalidateNavbar: CollectionAfterChangeHook = async ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    try {
      payload.logger.info(`Revalidating navbar for tenant ${doc.tenant}`)

      await revalidateTag('navbar')
      // Also revalidate the global header tag for backward compatibility during migration
      await revalidateTag('global_header')
    } catch (error) {
      // Ignore revalidation errors when running outside Next.js context (e.g., seed scripts)
      if (error instanceof Error && error.message.includes('static generation store missing')) {
        payload.logger.warn('Skipping navbar revalidation (not in Next.js request context)')
      } else {
        throw error
      }
    }
  }

  return doc
}
