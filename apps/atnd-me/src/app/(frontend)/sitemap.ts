import type { MetadataRoute } from 'next'
import { cookies, headers } from 'next/headers'

import { getPayload } from '@/lib/payload'
import { getTenantWithBranding } from '@/utilities/getTenantContext'
import { getAbsoluteURL, getRequestOrigin, getTenantSiteURL } from '@/utilities/getURL'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayload()
  const cookieStore = await cookies()
  const headersList = await headers()
  const tenant = await getTenantWithBranding(payload, { cookies: cookieStore, headers: headersList })
  const siteUrl = tenant ? getTenantSiteURL(tenant, headersList) : getRequestOrigin(headersList)
  const dateFallback = new Date().toISOString()

  const [pages, posts] = await Promise.all([
    payload.find({
      collection: 'pages',
      overrideAccess: false,
      draft: false,
      depth: 0,
      limit: 1000,
      pagination: false,
      where: {
        _status: {
          equals: 'published',
        },
        tenant: {
          equals: tenant?.id ?? null,
        },
      },
      select: {
        slug: true,
        updatedAt: true,
      },
    }),
    payload.find({
      collection: 'posts',
      overrideAccess: false,
      draft: false,
      depth: 0,
      limit: 1000,
      pagination: false,
      where: {
        _status: {
          equals: 'published',
        },
      },
      select: {
        slug: true,
        updatedAt: true,
      },
    }),
  ])

  const routes: MetadataRoute.Sitemap = [
    {
      url: getAbsoluteURL('/search', siteUrl),
      lastModified: dateFallback,
    },
    {
      url: getAbsoluteURL('/posts', siteUrl),
      lastModified: dateFallback,
    },
  ]

  for (const page of pages.docs ?? []) {
    if (!page?.slug) continue

    const pathname =
      page.slug === 'home' || (!tenant && page.slug === 'root') ? '/' : `/${page.slug}`

    routes.push({
      url: getAbsoluteURL(pathname, siteUrl),
      lastModified: page.updatedAt || dateFallback,
    })
  }

  for (const post of posts.docs ?? []) {
    if (!post?.slug) continue

    routes.push({
      url: getAbsoluteURL(`/posts/${post.slug}`, siteUrl),
      lastModified: post.updatedAt || dateFallback,
    })
  }

  return routes
}
