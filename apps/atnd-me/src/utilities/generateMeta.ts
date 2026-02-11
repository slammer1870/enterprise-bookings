import type { Metadata } from 'next'

import type { Media, Page, Post, Config } from '../payload-types'

import { mergeOpenGraph } from './mergeOpenGraph'
import { getServerSideURL } from './getURL'
import type { TenantWithBranding } from './getTenantContext'

const getImageURL = (image?: Media | Config['db']['defaultIDType'] | null) => {
  const serverUrl = getServerSideURL()

  let url = serverUrl + '/website-template-OG.webp'

  if (image && typeof image === 'object' && 'url' in image) {
    const ogUrl = image.sizes?.og?.url

    url = ogUrl ? serverUrl + ogUrl : serverUrl + image.url
  }

  return url
}

const DEFAULT_SITE_NAME = 'Payload Website Template'

export const generateMeta = async (args: {
  doc: Partial<Page> | Partial<Post> | null
  tenantBranding?: TenantWithBranding | null
}): Promise<Metadata> => {
  const { doc, tenantBranding } = args

  const ogImage = getImageURL(doc?.meta?.image)

  const siteName = tenantBranding?.name || DEFAULT_SITE_NAME
  const title = doc?.meta?.title
    ? `${doc.meta.title} | ${siteName}`
    : siteName

  const description = doc?.meta?.description || tenantBranding?.description || undefined

  return {
    description,
    openGraph: mergeOpenGraph({
      description: description || '',
      images: ogImage
        ? [
            {
              url: ogImage,
            },
          ]
        : undefined,
      title,
      url: Array.isArray(doc?.slug) ? doc?.slug.join('/') : '/',
    }),
    title,
  }
}
