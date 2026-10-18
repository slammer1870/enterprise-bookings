# 10 — Serve every host the declaration marks as serving

**What to build:** A tenant saved with the hostname list and Direction serves a page on every serving host. The canonical link and the Open Graph URL on each of those hosts name the canonical host. A serving host that is not the canonical host publishes `robots.txt` and redirects its sitemap to the canonical host. A row that has not been saved with the new declaration still follows today's public-host behavior.

**Blocked by:** 09 — Store the hostname list and Direction

**Status:** done

**Verified by:** `apps/atnd-me/tests/e2e/serve-declared-hosts.e2e.spec.ts`. Unknown host, missing branding, and the platform mark: `apps/atnd-me/tests/e2e/unknown-host-and-failed-lookup.e2e.spec.ts`. A row that still has only the custom domain and the alias list: `apps/atnd-me/tests/e2e/redirect-alias-hosts.e2e.spec.ts`. A second `*.nip.io` custom domain in the same database is refused, because that name claims the apex `nip.io`. The forced-failure test and the legacy custom-domain serve tests did not get past creating that second tenant.

- [x] Allow www and non-www on `www.example.com, example.com` returns 200 for `/` and for a content path on both hosts, with no `noindex`
- [x] On each of those hosts the canonical link and the Open Graph URL are `https://example.com<path>`, with no query and no port
- [x] `https://www.example.com/kids?ref=1` returns 200 and names `https://example.com/kids`
- [x] `/robots.txt` on `www.example.com` returns 200, allows `/`, disallows `/admin/` and `/api/`, and its Sitemap line is `https://example.com/sitemap.xml`
- [x] `https://www.example.com/sitemap.xml` returns 301 to `https://example.com/sitemap.xml`. The test observes that 301
- [x] The canonical host's sitemap lists `/`, `/search`, `/posts`, each published page, and each published post as indexed URLs
- [x] `/pages-sitemap.xml` and `/posts-sitemap.xml` on a serving host return 404
- [x] A lone hostname serves as the canonical host
- [x] A hostname outside a complete pair, such as `mysite.example.com`, returns 200 and names the canonical host as the indexed URL
- [x] An empty list serves the site on the platform subdomain
- [x] An unknown host is a 404 titled "Not found", with no icon and `noindex`, for the page, `/robots.txt`, `/sitemap.xml`, `/pages-sitemap.xml`, and `/posts-sitemap.xml`
- [x] A failed lookup is a 503 titled "Unavailable", with no icon and `noindex`, for those same paths, and the body is not a homepage sitemap
- [x] A resolved tenant keeps its name, description, and site name. No logo means no icon. No page image means no share image. The platform mark is emitted only on a platform host
- [x] A row that only has the custom domain, the alias list, and Redirect apex still follows today's public-host behavior
