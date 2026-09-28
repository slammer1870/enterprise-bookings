import type { MetadataRoute } from 'next'
import { cookies, headers } from 'next/headers'

import { getPayload } from '@/lib/payload'
import { getTenantWithBranding } from '@/utilities/getTenantContext'
import { getAbsoluteURL, getRequestOrigin, getTenantSiteURL } from '@/utilities/getURL'

export const dynamic = 'force-dynamic'

type SitemapDoc = { slug?: string | null; updatedAt?: string | null }

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cookieStore = await cookies()
  const headersList = await headers()
  const requestOrigin = getRequestOrigin(headersList)
  const dateFallback = new Date().toISOString()

  let siteUrl = requestOrigin
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
      siteUrl = getTenantSiteURL(tenant, headersList)

      const [pageResult, postResult] = await Promise.all([
        payload.find({
          collection: 'pages',
          overrideAccess: false,
          draft: false,
          depth: 0,
          limit: 1000,
          pagination: false,
          where: {
            _status: { equals: 'published' },
            tenant: { equals: tenant.id },
          },
          select: { slug: true, updatedAt: true },
        }),
        payload.find({
          collection: 'posts',
          overrideAccess: false,
          draft: false,
          depth: 0,
          limit: 1000,
          pagination: false,
          where: {
            _status: { equals: 'published' },
            tenant: { equals: tenant.id },
          },
          select: { slug: true, updatedAt: true },
        }),
      ])
      pages = pageResult.docs as SitemapDoc[]
      posts = postResult.docs as SitemapDoc[]
    }
  } catch (error) {
    // A crawler must still receive a valid sitemap if the CMS is temporarily
    // unavailable. The homepage is better than a 500 and can lead Google back
    // to the rest of the site.
    console.error('Unable to build tenant sitemap from Payload:', error)
  }

  const routes: MetadataRoute.Sitemap = [
    {
      url: getAbsoluteURL('/', siteUrl),
      lastModified: dateFallback,
    },
    {
      url: getAbsoluteURL('/search', siteUrl),
      lastModified: dateFallback,
    },
    {
      url: getAbsoluteURL('/posts', siteUrl),
      lastModified: dateFallback,
    },
  ]

  for (const page of pages) {
    if (!page?.slug) continue

    const pathname =
      page.slug === 'home' || (!isTenantSite && page.slug === 'root') ? '/' : `/${page.slug}`

    routes.push({
      url: getAbsoluteURL(pathname, siteUrl),
      lastModified: page.updatedAt || dateFallback,
    })
  }

  for (const post of posts) {
    if (!post?.slug) continue

    routes.push({
      url: getAbsoluteURL(`/posts/${post.slug}`, siteUrl),
      lastModified: post.updatedAt || dateFallback,
    })
  }

  return routes
}
