import type { MetadataRoute } from 'next'
import { cookies, headers } from 'next/headers'

import { getPayload } from '@/lib/payload'
import { getTenantWithBranding } from '@/utilities/getTenantContext'
import { getCanonicalHostname, getIndexedURL, getRequestOrigin } from '@/utilities/getURL'

/**
 * robots.txt names the canonical host's sitemap. The request host can include
 * a port, and the request scheme is not the indexed URL.
 */
export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers()
  const cookieStore = await cookies()
  let sitemap = `${getRequestOrigin(headersList)}/sitemap.xml`

  try {
    const payload = await getPayload()
    const tenant = await getTenantWithBranding(payload, {
      cookies: cookieStore,
      headers: headersList,
    })
    const canonicalHostname = getCanonicalHostname(tenant)
    if (canonicalHostname) {
      sitemap = getIndexedURL(canonicalHostname, '/sitemap.xml')
    }
  } catch (error) {
    console.error('Unable to resolve canonical host for robots.txt:', error)
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
