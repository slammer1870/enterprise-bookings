import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import type { Page } from '../../../payload-types'
import { revalidatePath, revalidateTag } from '../../../utilities/next-cache'

export const revalidatePage: CollectionAfterChangeHook<Page> = async ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    try {
      if (doc._status === 'published') {
        const path = doc.slug === 'home' ? '/' : `/${doc.slug}`
        const tenantKey =
          doc.tenant == null
            ? 'root'
            : String(typeof doc.tenant === 'object' && doc.tenant && 'id' in doc.tenant ? doc.tenant.id : doc.tenant)

        payload.logger.info(`Revalidating page at path: ${path}`)

        await revalidatePath(path)
        await revalidateTag('pages-sitemap')
        await revalidateTag(`page_${tenantKey}_${doc.slug}`)
        await revalidateTag('pages')
      }

      // If the page was previously published, we need to revalidate the old path
      if (previousDoc?._status === 'published' && doc._status !== 'published') {
        const oldPath = previousDoc.slug === 'home' ? '/' : `/${previousDoc.slug}`
        const tenantKey =
          previousDoc.tenant == null
            ? 'root'
            : String(
                typeof previousDoc.tenant === 'object' && previousDoc.tenant && 'id' in previousDoc.tenant
                  ? previousDoc.tenant.id
                  : previousDoc.tenant,
              )

        payload.logger.info(`Revalidating old page at path: ${oldPath}`)

        await revalidatePath(oldPath)
        await revalidateTag('pages-sitemap')
        await revalidateTag(`page_${tenantKey}_${previousDoc.slug}`)
        await revalidateTag('pages')
      }
    } catch (error) {
      // Ignore revalidation errors when running outside Next.js context (e.g., seed scripts)
      if (error instanceof Error && error.message.includes('static generation store missing')) {
        payload.logger.warn('Skipping revalidation (not in Next.js request context)')
      } else {
        throw error
      }
    }
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Page> = async ({ doc, req: { context, payload } }) => {
  if (!context.disableRevalidate) {
    try {
      const path = doc?.slug === 'home' ? '/' : `/${doc?.slug}`
      const tenantKey =
        doc?.tenant == null
          ? 'root'
          : String(
              typeof doc.tenant === 'object' && doc.tenant && 'id' in doc.tenant ? doc.tenant.id : doc.tenant,
            )
      await revalidatePath(path)
      await revalidateTag('pages-sitemap')
      if (doc?.slug) {
        await revalidateTag(`page_${tenantKey}_${doc.slug}`)
        await revalidateTag('pages')
      }
    } catch (error) {
      // Ignore revalidation errors when running outside Next.js context (e.g., seed scripts)
      if (error instanceof Error && error.message.includes('static generation store missing')) {
        payload.logger.warn('Skipping revalidation (not in Next.js request context)')
      } else {
        throw error
      }
    }
  }

  return doc
}
