import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import config from '@/payload.config'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayload({ config })
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://mindfulyard.ie'

  const results = await payload.find({
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

  const sitemap: MetadataRoute.Sitemap = []

  for (const page of results.docs) {
    if (page.slug) {
      sitemap.push({
        changeFrequency: 'monthly',
        lastModified: page.updatedAt,
        priority: 1,
        url: `${serverUrl}/${page.slug === 'home' ? '' : page.slug}`,
      })
    }
  }

  return sitemap
}
