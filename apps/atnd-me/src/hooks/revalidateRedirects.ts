import type { CollectionAfterChangeHook } from 'payload'

import { revalidateTag } from '../utilities/next-cache'

export const revalidateRedirects: CollectionAfterChangeHook = async ({ doc, req: { payload } }) => {
  payload.logger.info(`Revalidating redirects`)

  await revalidateTag('redirects')

  return doc
}
