import { headers } from 'next/headers'

import { guardPublicHostAppRoute } from '@/utilities/guardPublicHostAppRoute'

/** Legacy multi-tenant sitemap. The canonical host does not publish these routes. */
export async function legacySitemapNotFound(): Promise<Response> {
  await guardPublicHostAppRoute(await headers())
  return new Response(null, { status: 404 })
}
