import type { GlobalAfterChangeHook } from 'payload'

import { revalidateTag } from 'next/dist/server/web/spec-extension/revalidate'

export const revalidateNavbar: GlobalAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Revalidating navbar`)

    revalidateTag('global_navbar')
  }

  return doc
}
