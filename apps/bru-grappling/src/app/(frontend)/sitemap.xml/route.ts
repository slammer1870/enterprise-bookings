import { getServerSideSitemap } from 'next-sitemap'

export async function GET() {
  const SITE_URL =
    process.env.NEXT_PUBLIC_SERVER_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    'https://brugrappling.ie'

  // Main sitemap index that references other sitemaps
  const sitemaps = [
    {
      loc: `${SITE_URL}/pages-sitemap.xml`,
      lastmod: new Date().toISOString(),
    },
    {
      loc: `${SITE_URL}/posts-sitemap.xml`,
      lastmod: new Date().toISOString(),
    },
  ]

  return getServerSideSitemap(sitemaps)
}