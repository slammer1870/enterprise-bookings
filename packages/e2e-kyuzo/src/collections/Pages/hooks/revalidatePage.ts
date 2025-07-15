import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { revalidatePath, revalidateTag } from 'next/cache'

import type { Page } from '@/payload-types'

export const revalidatePage: CollectionAfterChangeHook<Page> = ({
  doc,
  previousDoc: _previousDoc,
  req: { payload, context: _context },
}) => {
  const path = doc.slug === 'home' ? '/' : `/${doc.slug}`

  payload.logger.info(`Revalidating page at path: ${path}`)

  revalidatePath(path)
  revalidateTag('pages-sitemap')

  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Page> = ({ doc, req: { context: _context } }) => {
  const path = doc?.slug === 'home' ? '/' : `/${doc?.slug}`
  revalidatePath(path)
  revalidateTag('pages-sitemap')

  return doc
}
