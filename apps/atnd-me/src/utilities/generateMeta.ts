import type { Metadata } from 'next'

import type { Media, Page, Post, Config } from '../payload-types'

import { mergeOpenGraph } from './mergeOpenGraph'
import { getAbsoluteURL, getTenantSiteURL } from './getURL'
import type { TenantWithBranding } from './getTenantContext'

const getImageURL = (args: {
  baseURL: string
  image?: Media | Config['db']['defaultIDType'] | null
  fallbackImage?:
    | Media
    | { url?: string; sizes?: { og?: { url?: string | null } | null } | null }
    | Config['db']['defaultIDType']
    | null
}) => {
  const { baseURL, image, fallbackImage } = args

  let url = getAbsoluteURL('/website-template-OG.webp', baseURL)

  const resolvedImage = [image, fallbackImage].find(
    (candidate): candidate is Media => Boolean(candidate && typeof candidate === 'object' && 'url' in candidate),
  )

  if (resolvedImage) {
    const ogUrl = resolvedImage.sizes?.og?.url
    const imagePath = ogUrl || resolvedImage.url

    if (imagePath) {
      url = getAbsoluteURL(imagePath, baseURL)
    }
  }

  return url
}

const DEFAULT_SITE_NAME = 'ATND ME'

export const generateMeta = async (args: {
  doc: Partial<Page> | Partial<Post> | null
  tenantBranding?: TenantWithBranding | null
  pathname?: string
  currentPath?: string
  headers?: Headers
}): Promise<Metadata> => {
  const { doc, tenantBranding, pathname, currentPath, headers } = args
  const siteUrl = getTenantSiteURL(tenantBranding, headers)

  const ogImage = getImageURL({
    baseURL: siteUrl,
    image: doc?.meta?.image,
    fallbackImage: tenantBranding?.logo,
  })

  const siteName = tenantBranding?.name || DEFAULT_SITE_NAME
  const docTitle = typeof doc?.meta?.title === 'string' ? doc.meta.title.trim() : ''
  const title = docTitle || undefined

  const description = doc?.meta?.description || tenantBranding?.description || undefined
  const resolvedPath =
    pathname ||
    currentPath ||
    (typeof doc?.slug === 'string' && doc.slug ? `/${doc.slug}` : '/')
  const canonicalUrl = getAbsoluteURL(resolvedPath, siteUrl)
  const fullTitle = docTitle ? `${docTitle} | ${siteName}` : siteName

  return {
    alternates: {
      canonical: canonicalUrl,
    },
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
      siteName,
      title: fullTitle,
      url: canonicalUrl,
    }),
    twitter: {
      card: 'summary_large_image',
      description,
      images: ogImage ? [ogImage] : undefined,
      title: fullTitle,
    },
    title,
  }
}
