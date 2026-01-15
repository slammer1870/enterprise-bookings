// Mark this route as dynamic to avoid static generation issues with Payload GraphQL schema
export const dynamic = 'force-dynamic'

import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayload({ config })
  const serverUrl =
    process.env.NEXT_PUBLIC_SERVER_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    'https://brugrappling.ie'

  const sitemap: MetadataRoute.Sitemap = []

  // Fetch pages
  const pagesResult = await payload.find({
    collection: 'pages',
    overrideAccess: false,
    draft: false,
    depth: 0,
    limit: 1000,
    pagination: false,
    select: {
      slug: true,
      updatedAt: true,
    },
  })

  // Add pages to sitemap
  for (const page of pagesResult.docs) {
    if (page.slug) {
      sitemap.push({
        changeFrequency: 'weekly',
        lastModified: page.updatedAt as unknown as string | Date,
        priority: page.slug === 'home' ? 1 : 0.8,
        url: `${serverUrl}/${page.slug === 'home' ? '' : page.slug}`,
      })
    }
  }

  // Fetch posts
  const postsResult = await payload.find({
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
  })

  // Add posts to sitemap
  for (const post of postsResult.docs) {
    if (post.slug) {
      sitemap.push({
        changeFrequency: 'weekly',
        lastModified: post.updatedAt as unknown as string | Date,
        priority: 0.7,
        url: `${serverUrl}/blog/${post.slug}`,
      })
    }
  }

  return sitemap
}
