# 12 — Publish sitemap and robots on the canonical host

**What to build:** The canonical host serves `/sitemap.xml` and `robots.txt`. The sitemap lists the tenant's public paths as indexed URLs. `robots.txt` tells crawlers to read that sitemap and to skip admin and API paths.

**Blocked by:** 10 — Serve the named canonical host

**Status:** done

**Verified by:** `apps/atnd-me/tests/e2e/sitemap-and-robots.e2e.spec.ts`, `apps/atnd-me/src/app/(frontend)/(sitemaps)/`

- [x] `/sitemap.xml` on the canonical host lists `/`, `/search`, `/posts`, each published page, and each published post
- [x] Every sitemap URL is an indexed URL: `https://<canonical host><path>`, with no query and no port
- [x] Unpublished pages and posts are absent from the sitemap
- [x] `robots.txt` on the canonical host allows `/`, disallows `/admin/` and `/api/`, and its Sitemap line is `https://<canonical host>/sitemap.xml`
- [x] A Playwright request against the running app observes both responses
