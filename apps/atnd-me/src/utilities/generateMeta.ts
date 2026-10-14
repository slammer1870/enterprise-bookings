import type { Metadata } from 'next'

import type { Media, Page, Post, Config } from '../payload-types'

import { mergeOpenGraph } from './mergeOpenGraph'
import {
  getAbsoluteURL,
  getCanonicalHostname,
  getIndexedURL,
  getTenantSiteURL,
} from './getURL'
import type { TenantWithBranding } from './getTenantContext'
import { isPlatformPublicHostname } from './publicHostOutcome'
import { getRequestHostname } from './tenantRequest'

const mediaUrlHasScheme = (value: string) => /^[a-z][a-z\d+.-]*:/i.test(value)

/**
 * A media URL with a scheme is already absolute, host included.
 * A media URL with no scheme is a path.
 */
const mediaPath = (mediaUrl: string): string | null => {
  if (mediaUrlHasScheme(mediaUrl)) return null
  return mediaUrl.startsWith('/') ? mediaUrl : `/${mediaUrl}`
}

const shareImageFromMediaUrl = (mediaUrl: string, canonicalHost: string): string => {
  const path = mediaPath(mediaUrl)
  if (path == null) return mediaUrl
  return `https://${canonicalHost}${path}`
}

const getImageURL = (args: {
  baseURL: string
  canonicalHost?: string | null
  image?: Media | Config['db']['defaultIDType'] | null
  fallbackImage?:
    | Media
    | { url?: string; sizes?: { og?: { url?: string | null } | null } | null }
    | Config['db']['defaultIDType']
    | null
}) => {
  const { baseURL, canonicalHost, image, fallbackImage } = args

  const resolvedImage = [image, fallbackImage].find(
    (candidate): candidate is Media => Boolean(candidate && typeof candidate === 'object' && 'url' in candidate),
  )

  if (resolvedImage) {
    const ogUrl = resolvedImage.sizes?.og?.url
    const imagePath = ogUrl || resolvedImage.url

    if (imagePath) {
      if (canonicalHost) return shareImageFromMediaUrl(imagePath, canonicalHost)
      if (mediaUrlHasScheme(imagePath)) return imagePath
      return getAbsoluteURL(imagePath, baseURL)
    }
  }

  return undefined
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
  const requestHostname = getRequestHostname(headers)
  const usePlatformDefaults = Boolean(
    requestHostname && isPlatformPublicHostname(requestHostname) && !tenantBranding,
  )

  const canonicalHostname = getCanonicalHostname(tenantBranding)
  const ogImage = getImageURL({
    baseURL: siteUrl,
    canonicalHost: canonicalHostname,
    image: doc?.meta?.image,
  })

  const siteName = tenantBranding?.name || DEFAULT_SITE_NAME
  const docTitle = typeof doc?.meta?.title === 'string' ? doc.meta.title.trim() : ''
  // A string title is run through the root layout template (`%s | ${appName}`).
  // With no separate page meta title, the document title is the tenant name itself.
  const title = docTitle ? docTitle : { absolute: siteName }

  const description = doc?.meta?.description || tenantBranding?.description || undefined
  const resolvedPath =
    pathname ||
    currentPath ||
    (typeof doc?.slug === 'string' && doc.slug ? `/${doc.slug}` : '/')
  const canonicalUrl = canonicalHostname
    ? getIndexedURL(canonicalHostname, resolvedPath)
    : getAbsoluteURL(resolvedPath, siteUrl)
  const fullTitle = docTitle ? `${docTitle} | ${siteName}` : siteName

  return {
    alternates: {
      canonical: canonicalUrl,
    },
    description,
    openGraph: mergeOpenGraph(
      {
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
      },
      { usePlatformDefaults },
    ),
    twitter: {
      card: 'summary_large_image',
      description,
      images: ogImage ? [ogImage] : undefined,
      title: fullTitle,
    },
    title,
  }
}
