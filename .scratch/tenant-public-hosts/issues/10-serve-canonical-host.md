# 10 — Serve the named canonical host

**What to build:** An org admin names a canonical host for a tenant, including an apex. A request to that host returns the page. The canonical link and the Open Graph URL are the indexed URL, and the page uses the tenant's name. When no canonical host is named, the platform subdomain does this instead. A tenant that still only has the existing custom-domain setup keeps its current public behavior.

**Blocked by:** None — can start immediately

**Status:** done

**Verified by:** `apps/atnd-me/tests/e2e/serve-canonical-host.e2e.spec.ts`, `apps/atnd-me/tests/unit/tenant-seo-url.test.ts`, `apps/atnd-me/src/utilities/getURL.ts`, `apps/atnd-me/src/utilities/generateMeta.ts`

- [x] Naming a canonical host, including an apex, makes `https://<canonical host><path>` return 200
- [x] The canonical link and the Open Graph URL are `https://<canonical host><path>`, with no query and no port, even when the request carries a query or a port
- [x] The path in the indexed URL is the request path
- [x] The served page uses the tenant's name
- [x] With no canonical host named, the platform subdomain returns 200 and its indexed URL uses the platform subdomain
- [x] A tenant that only has the existing custom-domain and apex-redirect setup keeps its current public behavior
- [x] A Playwright request against the running app observes this response
