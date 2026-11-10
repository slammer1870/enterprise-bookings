/**
 * The old public SVG was the platform mark on every host. Google used it whenever
 * the linked logo was ineligible. Keep this path from serving that file.
 */
export function GET(): Response {
  return new Response(null, {
    status: 404,
    headers: { 'cache-control': 'public, max-age=3600' },
  })
}
