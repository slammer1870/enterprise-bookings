# 11 — Redirect alias hosts to the canonical host

**What to build:** Once a canonical host is named, every alias host 301s to it. That includes `www`, the platform subdomain, and an alias on another apex. The target keeps the path and the query, uses https, and has no port. The alias serves no page of its own. `/robots.txt`, every path under `/sitemap`, `/pages-sitemap.xml`, and `/posts-sitemap.xml` redirect too. On the canonical host, `/pages-sitemap.xml` and `/posts-sitemap.xml` return 404.

**Blocked by:** 10 — Serve the named canonical host

**Status:** done

**Verified by:** `apps/atnd-me/tests/e2e/redirect-alias-hosts.e2e.spec.ts`, `apps/atnd-me/tests/unit/middleware.test.ts`, `apps/atnd-me/src/middleware.ts`

- [x] A request to an alias host returns 301 to `https://<canonical host><path><query>`, with no port, and the test observes that 301 rather than only the final page
- [x] `www`, the platform subdomain, and an alias on another apex each redirect this way
- [x] `/robots.txt`, a path under `/sitemap`, `/pages-sitemap.xml`, and `/posts-sitemap.xml` on an alias host redirect to the same path and query on the canonical host
- [x] The alias response does not serve the tenant page
- [x] The canonical host returns 404 for `/pages-sitemap.xml` and `/posts-sitemap.xml`
- [x] With no canonical host named, the platform subdomain still serves and does not redirect
