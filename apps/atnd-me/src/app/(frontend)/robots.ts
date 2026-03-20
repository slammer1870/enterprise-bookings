import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'

import { getRequestOrigin } from '@/utilities/getURL'

export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers()
  const siteUrl = getRequestOrigin(headersList)

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/_next/'],
    },
    sitemap: getRequestOrigin(headersList) ? `${siteUrl}/sitemap.xml` : undefined,
  }
}
