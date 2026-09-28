import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'

import { getRequestOrigin } from '@/utilities/getURL'

/**
 * robots.txt must be generated from the public request host. Using
 * NEXT_PUBLIC_SERVER_URL here points custom tenant domains at the platform
 * sitemap instead of their own sitemap.
 */
export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const siteUrl = getRequestOrigin(await headers())

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
