# 11 — Redirect each alias host to its pair partner

**What to build:** Redirect to www and Redirect to non-www send an alias host to the other hostname in its www/apex pair. The redirect keeps the path and the query, uses https, and has no port. The platform subdomain redirects to the canonical host once any custom hostname is named. A hostname with no pair partner still serves.

**Blocked by:** 10 — Serve every host the declaration marks as serving

**Status:** done

**Verified by:** `apps/atnd-me/tests/e2e/redirect-alias-to-pair-partner.e2e.spec.ts`. A row that still has only the custom domain and the alias list: `apps/atnd-me/tests/e2e/redirect-alias-hosts.e2e.spec.ts`.

- [x] Redirect to www on `www.example.com, example.com` returns 301 from `example.com` to `https://www.example.com<path><query>`, with no port. The test observes that 301, and the response is not the page
- [x] Redirect to non-www on that list returns 301 from `www.example.com` to `https://example.com<path><query>`, with no port
- [x] That 301 applies to `/`, a content path, `/robots.txt`, `/sitemap.xml`, `/pages-sitemap.xml`, and `/posts-sitemap.xml`
- [x] For `www.example.com, example.com, www.other.com, other.com` with Redirect to non-www, `https://www.other.com/sitemap.xml` returns 301 to `https://other.com/sitemap.xml`, and that host returns 301 to the canonical host's sitemap
- [x] `https://www.other.com/pages-sitemap.xml` returns 301 to `https://other.com/pages-sitemap.xml`, and that host returns 404
- [x] `other.com` returns 200 and names the canonical host as the indexed URL
- [x] `www.other.com` without `other.com` serves. The missing hostname is not invented
- [x] Once any custom hostname is named, the platform subdomain returns 301 to `https://<canonical host><path><query>`, with no port
- [x] With no custom hostname, the platform subdomain serves and does not redirect
- [x] The origin issues the 301
- [x] A row that only has the custom domain, the alias list, and Redirect apex still redirects an alias to the stored custom domain, as it does today
