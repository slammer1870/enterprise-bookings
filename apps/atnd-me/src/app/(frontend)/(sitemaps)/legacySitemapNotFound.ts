/** Legacy multi-tenant sitemap. The canonical host does not publish these routes. */
export function legacySitemapNotFound(): Response {
  return new Response(null, { status: 404 })
}
