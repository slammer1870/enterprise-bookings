# 13 — Answer unknown hosts and failed lookups without the platform mark

**What to build:** An unknown host is a 404 titled "Not found", with no icon and `noindex`. A lookup that throws is a 503 titled "Unavailable", with no icon and `noindex`. Both cover the page, `robots.txt`, and the sitemap paths, and neither publishes a homepage sitemap. A resolved tenant with no logo emits no icon. A page with no image of its own emits no share image. The platform mark appears only on a platform host.

**Blocked by:** 12 — Publish sitemap and robots on the canonical host

**Status:** done

**Verified by:** `apps/atnd-me/tests/e2e/unknown-host-and-failed-lookup.e2e.spec.ts`, `apps/atnd-me/tests/unit/public-host-outcome.test.ts`, `apps/atnd-me/tests/unit/guard-public-host-app-route.test.ts`, `apps/atnd-me/src/utilities/publicHostOutcome.ts`

- [x] An unknown host returns 404, titled "Not found", with no icon and `noindex`, for the page, `/robots.txt`, `/sitemap.xml`, `/pages-sitemap.xml`, and `/posts-sitemap.xml`
- [x] A thrown host lookup returns 503, titled "Unavailable", with no icon and `noindex`, for those same paths
- [x] Neither response publishes a homepage sitemap
- [x] A resolved tenant with no logo keeps the tenant's name and emits no icon
- [x] A page with no image of its own emits no share image
- [x] The platform mark is emitted only on a platform host
- [x] The failed-lookup case is the same Playwright seam, with resolution forced to throw
