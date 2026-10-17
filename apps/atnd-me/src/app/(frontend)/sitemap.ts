import type { MetadataRoute } from 'next'
import { cookies, headers } from 'next/headers'

import type { Payload } from 'payload'

import { getRequestOrigin } from '@/utilities/getURL'
import {
  publicMetadataURL,
  resolvePublicTenant,
} from '@/utilities/resolvePublicTenant'
import { guardPublicHostAppRoute } from '@/utilities/guardPublicHostAppRoute'
import { publicHostErrorResponse } from '@/utilities/publicHostOutcome'

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
  await guardPublicHostAppRoute(headersList)

  const dateFallback = new Date().toISOString()

  let resolved = {
    indexedHost: null as string | null,
    siteUrl: getRequestOrigin(headersList),
  }
  let pageDocs: SitemapDoc[] = []
  let postDocs: SitemapDoc[] = []
  let isTenantSite = false

  try {
    const tenantContext = await resolvePublicTenant({
      cookies: cookieStore,
      headers: headersList,
    })
    resolved = tenantContext

    if (tenantContext.tenant) {
      isTenantSite = true
      const [publishedPages, publishedPosts] = await Promise.all([
        publishedDocs(tenantContext.payload, 'pages', tenantContext.tenant.id),
        publishedDocs(tenantContext.payload, 'posts', tenantContext.tenant.id),
      ])
      pageDocs = publishedPages
      postDocs = publishedPosts
    }
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('Unable to build tenant sitemap from Payload:', error)
    throw publicHostErrorResponse('failed')
  }

  const urlFor = (path: string) => publicMetadataURL(path, resolved)

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

  for (const pageDoc of pageDocs) {
    if (!pageDoc?.slug) continue

    const pathname =
      pageDoc.slug === 'home' || (!isTenantSite && pageDoc.slug === 'root')
        ? '/'
        : `/${pageDoc.slug}`

    routes.push({
      url: urlFor(pathname),
      lastModified: pageDoc.updatedAt || dateFallback,
    })
  }

  for (const postDoc of postDocs) {
    if (!postDoc?.slug) continue

    routes.push({
      url: urlFor(`/posts/${postDoc.slug}`),
      lastModified: postDoc.updatedAt || dateFallback,
    })
  }

  return Array.from(new Map(routes.map((entry) => [entry.url, entry])).values())
}
