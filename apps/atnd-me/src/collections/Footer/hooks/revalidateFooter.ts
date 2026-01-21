import type { CollectionAfterChangeHook } from 'payload'

import { revalidateTag } from 'next/cache'

export const revalidateFooter: CollectionAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    try {
      payload.logger.info(`Revalidating footer for tenant ${doc.tenant}`)

      revalidateTag('footer')
      // Also revalidate the global footer tag for backward compatibility during migration
      revalidateTag('global_footer')
    } catch (error) {
      // Ignore revalidation errors when running outside Next.js context (e.g., seed scripts)
      if (error instanceof Error && error.message.includes('static generation store missing')) {
        payload.logger.warn('Skipping footer revalidation (not in Next.js request context)')
      } else {
        throw error
      }
    }
  }

  return doc
}
