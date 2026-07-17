import type { MetadataRoute } from 'next'

/**
 * Static robots.txt — avoid force-dynamic + headers() so crawlers always get a
 * stable 200 (Lighthouse was failing to download robots on preview).
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SERVER_URL?.replace(/\/$/, '') || 'https://www.atnd-preview.org'

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
