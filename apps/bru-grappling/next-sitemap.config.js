/** @type {import('next-sitemap').IConfig} */
export default {
  siteUrl: process.env.NEXT_PUBLIC_SERVER_URL || 'https://brugrappling.ie',
  generateRobotsTxt: false, // We're creating our own robots.txt
  generateIndexSitemap: false, // We're creating our own main sitemap
  exclude: [
    '/admin/*',
    '/api/*',
    '/_next/*',
    '/(payload)/*',
    '/magic-link-sent',
    '/my-route/*',
    '/dashboard/*',
    '/bookings/*',
    '/login',
    '/register'
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/_next/',
          '/(payload)/',
          '/magic-link-sent',
          '/my-route/',
          '/dashboard/',
          '/bookings/',
          '/login',
          '/register'
        ],
      },
    ],
    additionalSitemaps: [
      'https://brugrappling.ie/sitemap.xml',
      'https://brugrappling.ie/pages-sitemap.xml',
      'https://brugrappling.ie/posts-sitemap.xml',
    ],
  },
  changefreq: 'weekly',
  priority: 0.7,
  sitemapSize: 5000,
}
