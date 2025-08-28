import { getServerSideSitemap } from 'next-sitemap'

export async function GET() {
  const SITE_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'https://brugrappling.ie'
  
  const sitemap = [
    {
      loc: `${SITE_URL}/sitemap.xml`,
      lastmod: new Date().toISOString(),
    },
    {
      loc: `${SITE_URL}/pages-sitemap.xml`,
      lastmod: new Date().toISOString(),
    },
    {
      loc: `${SITE_URL}/posts-sitemap.xml`,
      lastmod: new Date().toISOString(),
    },
  ]

  return getServerSideSitemap(sitemap)
}
