import type { MetadataRoute } from 'next'
import { cookies, headers } from 'next/headers'

import { guardPublicHostAppRoute } from '@/utilities/guardPublicHostAppRoute'
import { publicHostErrorResponse } from '@/utilities/publicHostOutcome'
import { indexedSitemapURL, resolvePublicTenant } from '@/utilities/resolvePublicTenant'

/**
 * robots.txt names the canonical host's sitemap. The request host can include
 * a port, and the request scheme is not the indexed URL.
 */
export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers()
  const cookieStore = await cookies()
  await guardPublicHostAppRoute(headersList)

  let sitemap = indexedSitemapURL(null, headersList)

  try {
    const { indexedHost } = await resolvePublicTenant({
      cookies: cookieStore,
      headers: headersList,
    })
    sitemap = indexedSitemapURL(indexedHost, headersList)
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('Unable to resolve canonical host for robots.txt:', error)
    throw publicHostErrorResponse('failed')
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/'],
    },
    sitemap,
  }
}
