import type { MetadataRoute } from 'next'
import { notFound } from 'next/navigation'
import { cookies, headers } from 'next/headers'

import { indexedSitemapURL, resolvePublicTenant } from '@/utilities/resolvePublicTenant'
import { resolvePublicHostLookup } from '@/utilities/resolvePublicHostLookup'
import { getRequestHostname } from '@/utilities/tenantRequest'

/**
 * robots.txt names the canonical host's sitemap. The request host can include
 * a port, and the request scheme is not the indexed URL.
 */
export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers()
  const cookieStore = await cookies()
  const requestHostname = getRequestHostname(headersList)
  if (requestHostname) {
    const hostLookup = await resolvePublicHostLookup(requestHostname, headersList)
    if (hostLookup.kind === 'unknown' || hostLookup.kind === 'failed') {
      notFound()
    }
  }

  let sitemap = indexedSitemapURL(null, headersList)

  try {
    const { indexedHost } = await resolvePublicTenant({
      cookies: cookieStore,
      headers: headersList,
    })
    sitemap = indexedSitemapURL(indexedHost, headersList)
  } catch (error) {
    console.error('Unable to resolve canonical host for robots.txt:', error)
    notFound()
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
