import type { MetadataRoute } from 'next'
import { cookies, headers } from 'next/headers'

import { getPayload } from '@/lib/payload'
import type { Payload } from 'payload'
import { getTenantWithBranding } from '@/utilities/getTenantContext'
import {
  getAbsoluteURL,
  getCanonicalHostname,
  getIndexedURL,
  getRequestOrigin,
  getTenantSiteURL,
} from '@/utilities/getURL'

export const dynamic = 'force-dynamic'

type SitemapDoc = { slug?: string | null; updatedAt?: string | null }

const SITEMAP_PAGE_SIZE = 100

async function publishedDocs(
  payload: Payload,
  collection: 'pages' | 'posts',
  tenantId: number,
): Promise<SitemapDoc[]> {
  const docs: SitemapDoc[] = []
  let page = 1

  for (;;) {
    const result = await payload.find({
      collection,
      overrideAccess: false,
      draft: false,
      depth: 0,
      limit: SITEMAP_PAGE_SIZE,
      page,
      pagination: true,
      context: { tenant: tenantId },
      where: {
        _status: { equals: 'published' },
        tenant: { equals: tenantId },
      },
      select: { slug: true, updatedAt: true },
    })
    docs.push(...(result.docs as SitemapDoc[]))
    if (!result.hasNextPage) return docs
    page += 1
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cookieStore = await cookies()
  const headersList = await headers()
  const requestOrigin = getRequestOrigin(headersList)
  const dateFallback = new Date().toISOString()

  let siteUrl = requestOrigin
  let indexedHost: string | null = null
  let pages: SitemapDoc[] = []
  let posts: SitemapDoc[] = []
  let isTenantSite = false

  try {
    const payload = await getPayload()
    const tenant = await getTenantWithBranding(payload, {
      cookies: cookieStore,
      headers: headersList,
    })

    if (tenant) {
      isTenantSite = true
      indexedHost = getCanonicalHostname(tenant)
      if (!indexedHost) {
        siteUrl = getTenantSiteURL(tenant, headersList)
      }

      const [publishedPages, publishedPosts] = await Promise.all([
        publishedDocs(payload, 'pages', tenant.id),
        publishedDocs(payload, 'posts', tenant.id),
      ])
      pages = publishedPages
      posts = publishedPosts
    }
  } catch (error) {
    // A crawler must still receive a valid sitemap if the CMS is temporarily
    // unavailable. The homepage is better than a 500 and can lead Google back
    // to the rest of the site.
    console.error('Unable to build tenant sitemap from Payload:', error)
  }

  const urlFor = (path: string) =>
    indexedHost ? getIndexedURL(indexedHost, path) : getAbsoluteURL(path, siteUrl)

  const routes: MetadataRoute.Sitemap = [
    {
      url: urlFor('/'),
      lastModified: dateFallback,
    },
    {
      url: urlFor('/search'),
      lastModified: dateFallback,
    },
    {
      url: urlFor('/posts'),
      lastModified: dateFallback,
    },
  ]

  for (const page of pages) {
    if (!page?.slug) continue

    const pathname =
      page.slug === 'home' || (!isTenantSite && page.slug === 'root') ? '/' : `/${page.slug}`

    routes.push({
      url: urlFor(pathname),
      lastModified: page.updatedAt || dateFallback,
    })
  }

  for (const post of posts) {
    if (!post?.slug) continue

    routes.push({
      url: urlFor(`/posts/${post.slug}`),
      lastModified: post.updatedAt || dateFallback,
    })
  }

  return Array.from(new Map(routes.map((entry) => [entry.url, entry])).values())
}
