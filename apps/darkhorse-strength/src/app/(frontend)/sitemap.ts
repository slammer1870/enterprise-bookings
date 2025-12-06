import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'

const getSitemapData = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const SITE_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'https://darkhorsestrength.ie'

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

    // Add homepage
    sitemap.push({
      changeFrequency: 'weekly',
      lastModified: new Date().toISOString(),
      priority: 1,
      url: SITE_URL,
    })

    // Add pages
    if (results.docs) {
      for (const page of results.docs) {
        if (page?.slug && page.slug !== 'home') {
          sitemap.push({
            changeFrequency: 'weekly',
            lastModified: page.updatedAt || new Date().toISOString(),
            priority: 0.8,
            url: `${SITE_URL}/${page.slug}`,
          })
        }
      }
    }

    return sitemap
  },
  ['sitemap'],
  {
    tags: ['sitemap'],
    revalidate: 3600, // Revalidate every hour
  },
)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    return await getSitemapData()
  } catch (error) {
    console.error('Failed to generate sitemap:', error)
    // Return a basic sitemap with just the homepage
    return [
      {
        changeFrequency: 'weekly',
        lastModified: new Date().toISOString(),
        priority: 1,
        url: process.env.NEXT_PUBLIC_SERVER_URL || 'https://darkhorsestrength.ie',
      },
    ]
  }
}
