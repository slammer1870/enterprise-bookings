import type { GlobalAfterChangeHook } from 'payload'

import { revalidateTag } from '../../utilities/next-cache'

export const revalidateFooter: GlobalAfterChangeHook = async ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    try {
      payload.logger.info(`Revalidating footer`)

      await revalidateTag('global_footer')
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
