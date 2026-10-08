/** Legacy multi-tenant sitemap. The canonical host does not publish this route. */
export async function GET() {
  return new Response(null, { status: 404 })
}
