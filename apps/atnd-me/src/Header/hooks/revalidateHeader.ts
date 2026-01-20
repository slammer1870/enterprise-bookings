import type { GlobalAfterChangeHook } from 'payload'

import { revalidateTag } from 'next/cache'

export const revalidateHeader: GlobalAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    try {
      payload.logger.info(`Revalidating header`)

      revalidateTag('global_header')
    } catch (error) {
      // Ignore revalidation errors when running outside Next.js context (e.g., seed scripts)
      if (error instanceof Error && error.message.includes('static generation store missing')) {
        payload.logger.warn('Skipping header revalidation (not in Next.js request context)')
      } else {
        throw error
      }
    }
  }

  return doc
}
