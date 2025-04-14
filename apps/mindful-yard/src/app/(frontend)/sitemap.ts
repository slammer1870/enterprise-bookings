import type { MetadataRoute } from 'next'

const serverUrl = 'https://mindfulyard.ie'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { docs: pages } = await fetch(`${serverUrl}/api/pages?limit=0`).then((res) => res.json())

  const sitemap: MetadataRoute.Sitemap = []

  for (const page of pages) {
    sitemap.push({
      changeFrequency: 'monthly',
      lastModified: page.updatedAt,
      priority: 1,
      url: `${serverUrl}/${page.slug === 'home' ? '' : page.slug}`,
    })
  }

  return sitemap
}
