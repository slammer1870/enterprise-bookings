# Tenant public hosts

Status: done

## Problem Statement

A tenant can have several public hosts, and more than one of them serves pages. Bru Grappling's apex sends visitors to the `www` homepage and drops the path. `www` and the platform subdomain both serve Bru Grappling's pages and tell search engines to index `www`. The tenant cannot name the apex as the one host that serves.

An unknown host answers with the platform name and the platform mark. A lookup that fails does the same, and can still publish a homepage sitemap.

## Solution

The tenant names one canonical host. That host serves pages. Every alias host 301s to it and keeps the path and query. Once a custom canonical host exists, the platform subdomain is an alias host and 301s there too. Until then, the platform subdomain is the canonical host.

A page on the canonical host emits an indexed URL of `https://<canonical host><path>`, with no query and no port. The sitemap and `robots.txt` are served only on that host, and their URLs use it. The page carries the tenant's name, description, and site name. It uses the platform mark only on a platform host.

## User Stories

1. As an org admin, I want to name an optional canonical host for my tenant, so that one public host serves the site.
2. As an org admin, I want to name alias hosts together with a canonical host, so that older hostnames send visitors to the host that serves.
3. As an org admin, I want to leave the canonical host unnamed, so that the platform subdomain is the only public host and it serves the site.
4. As an org admin, I want naming an alias refused while no canonical host is named, so that a tenant cannot have a redirect with nothing to redirect to.
5. As an org admin, I want clearing the canonical host refused while an alias remains, so that I cannot leave an alias pointing nowhere.
6. As an org admin, I want replacing the canonical host to drop the previous hostname, so that the previous hostname stops serving.
7. As an org admin, I want to keep the previous canonical host by listing it as an alias, so that visitors to the old hostname still reach the new one.
8. As an org admin, I want a dropped hostname to be an unknown host, so that it no longer resolves to my tenant.
9. As an org admin, I want my canonical host refused as an alias, so that the serving host is not also a redirect.
10. As an org admin, I want a repeated hostname on my tenant refused, so that each public host has one role.
11. As a platform super-admin, I want the same declaration rules as an org admin, so that a hostname means the same thing whoever saves it.
12. As an org admin, I want a hostname with a scheme, path, port, or trailing dot refused, so that a public host is only a bare hostname.
13. As an org admin, I want `localhost`, `*.localhost`, and IP addresses refused, so that a public host is a real hostname.
14. As an org admin, I want the platform host, the platform apex, and any subdomain of the platform apex refused, so that a tenant cannot claim the platform's own names.
15. As an org admin, I want a hostname that is another tenant's canonical host, alias host, or platform subdomain refused, so that a public host belongs to one tenant.
16. As an org admin, I want an alias on a different apex from the canonical host, so that a second registrable domain can redirect to the serving host.
17. As an org admin, I want no fixed cap on alias hosts, so that every hostname I still use can redirect.
18. As an org admin, I want declaring a hostname to claim its apex, so that another tenant cannot name a hostname on `example.co.uk` after I have named `blog.shop.example.co.uk`.
19. As an org admin, I want the claim to last only while I still name a hostname on that apex, so that releasing the last name frees the apex.
20. As a visitor, I want a name I did not type on a claimed apex to be an unknown host, so that claiming an apex does not publish extra hosts.
21. As an org admin, I want a named host to take its role immediately, so that serving does not wait on DNS or a certificate.
22. As a visitor on an alias host, I want a 301 to `https://<canonical host><path><query>`, so that I land on the same page I asked for.
23. As a visitor on an alias host, I want the query preserved on that 301, so that `?ref=1` is still present on the canonical host.
24. As a visitor on an alias host, I want the redirect target to use https and no port, so that the public address does not depend on how the request reached the origin.
25. As a visitor on an alias host, I want `/robots.txt` to 301 to the same path on the canonical host, so that an alias does not publish its own robots file.
26. As a visitor on an alias host, I want every path under `/sitemap` to 301 to the same path on the canonical host, so that an alias does not publish its own sitemap.
27. As a visitor on an alias host, I want `/pages-sitemap.xml` and `/posts-sitemap.xml` to 301 to the same path on the canonical host, so that those routes follow the same host rule.
28. As a visitor on an alias host, I want no page of the tenant's site in the response, so that only the canonical host serves.
29. As a visitor on the platform subdomain, I want a 301 to the custom canonical host, so that the assigned hostname does not compete with the host the tenant named.
30. As a visitor on the platform subdomain when no custom canonical host is named, I want the site served there, so that a tenant with no custom domain still has a public host.
31. As a visitor on the platform apex, I want the platform's own redirect to the platform `www` host left as a platform concern, so that a tenant apex is not mixed up with the platform apex.
32. As a visitor on the canonical host, I want the page to load at the path I requested, so that `/kids` is that page and not the homepage.
33. As a search crawler, I want the canonical link on a served page to be the indexed URL, so that I index `https://<canonical host><path>` and not another host.
34. As a search crawler, I want the indexed URL to omit the query and the port, so that `/kids` and `/kids?ref=1` share one indexed URL.
35. As a search crawler, I want the path in the indexed URL to be the request path, so that the spec does not add a trailing-slash rule.
36. As a search crawler, I want `/sitemap.xml` only on the canonical host, so that I discover URLs on the host that serves.
37. As a search crawler, I want each sitemap URL to be an indexed URL, so that `/`, `/search`, `/posts`, each published page, and each published post are listed on the canonical host.
38. As a search crawler, I want unpublished pages and posts left out of the sitemap, so that I do not index drafts.
39. As a search crawler, I want `robots.txt` on the canonical host to allow `/`, disallow `/admin/` and `/api/`, and point its Sitemap line at `https://<canonical host>/sitemap.xml`, so that I crawl the public site and read the right sitemap.
40. As a search crawler, I want `/pages-sitemap.xml` and `/posts-sitemap.xml` on the canonical host to be 404, so that a second sitemap cannot list the platform origin.
41. As a visitor on an unknown host, I want a 404 titled "Not found", with no icon and `noindex`, so that the platform mark is not standing in for a missing tenant.
42. As a visitor on an unknown host, I want that 404 for the page, `/robots.txt`, `/sitemap.xml`, `/pages-sitemap.xml`, and `/posts-sitemap.xml`, so that an unknown host publishes none of those files.
43. As a visitor when the host lookup throws, I want a 503 titled "Unavailable", with no icon and `noindex`, so that a failed lookup is not treated as a missing tenant or as the platform site.
44. As a visitor when the host lookup throws, I want that 503 for the page, `/robots.txt`, `/sitemap.xml`, `/pages-sitemap.xml`, and `/posts-sitemap.xml`, so that a failure does not publish a homepage sitemap.
45. As a visitor on a resolved tenant with no logo, I want the document title to stay the tenant's name and no icon to be emitted, so that a missing logo does not become the platform mark.
46. As a visitor on a page with no image of its own, I want no share image, so that the platform's default image is not used for the tenant.
47. As a visitor, I want the title, description, and site name to stay the tenant's, so that the page is identified as that business.
48. As a search crawler, I want the Open Graph URL to be the indexed URL, so that a shared page names the canonical host and drops the query.
49. As a visitor on a platform host, I want the platform mark, so that the platform's own site keeps its icon and default share image.
50. As a visitor to Bru Grappling, I want `https://brugrappling.ie/kids` to return 200, so that the apex serves the kids page.
51. As a search crawler on that page, I want the canonical link, the Open Graph URL, and the sitemap URL to be `https://brugrappling.ie/kids`, so that the apex is the host I index.
52. As a visitor to `https://www.brugrappling.ie/kids?ref=1`, I want a 301 to `https://brugrappling.ie/kids?ref=1`, so that `www` redirects and keeps the path and the query.
53. As a visitor to `https://brugrappling.atnd.me/kids?ref=1`, I want a 301 to `https://brugrappling.ie/kids?ref=1`, so that the platform subdomain redirects the same way.
54. As a visitor to `www.brugrappling.ie`, I want it not to return 200, so that `www` is an alias host and not a second serving host.

## Implementation Decisions

- The tenant record stores an optional canonical host and a list of alias hosts. The platform subdomain is assigned from the slug and is not a custom domain. The single custom-domain field, the apex-redirect flag, and the derived apex hostname stop being the source of which host serves and which host redirects. This spec does not migrate existing rows.
- Host resolution for a request hostname has three outcomes. The canonical host serves. An alias host, including the platform subdomain once a custom canonical host exists, redirects. Any other hostname is an unknown host. Resolution does not prefer `www`, and it does not treat an apex as a redirect to a stored `www` hostname.
- The origin issues the 301. The target is exactly `https://<canonical host><path><query>` with no port. Cloudflare proxies the alias host and does not redirect it. The redirect applies to every request on that host, including `/robots.txt`, every path under `/sitemap`, `/pages-sitemap.xml`, and `/posts-sitemap.xml`. Paths that today skip the redirect layer still 301 when the host is an alias.
- The internal host lookup that middleware uses today returns a redirect to the stored serving hostname for an apex hit. It instead reports the canonical host, and the caller redirects only when the request host is an alias. A thrown lookup is a failed lookup, which becomes a 503, not a 404 and not a platform-branded page.
- The indexed URL is built from the canonical host and the request path. Scheme is https. Query and port are omitted. The canonical link and the Open Graph URL on a served page both use it. Sitemap entries use it. They are not taken from the request host.
- The canonical host's sitemap lists `/`, `/search`, `/posts`, each published page, and each published post. A failed lookup does not substitute a homepage sitemap. `/pages-sitemap.xml` and `/posts-sitemap.xml` are not tenant sitemaps. On the canonical host they return 404. On an alias host they 301, and the canonical host then returns 404.
- `robots.txt` on the canonical host allows `/`, disallows `/admin/` and `/api/`, and its Sitemap line is `https://<canonical host>/sitemap.xml`. An alias host 301s `/robots.txt` and does not serve a robots file.
- A resolved tenant keeps its name as the document title when it has no separate page title, and keeps its description and site name. No logo means no icon. No page image means no share image. The platform mark is emitted only on a platform host.
- An unknown host is a 404 titled "Not found", with no icon and `noindex`, for the page and for `/robots.txt`, `/sitemap.xml`, `/pages-sitemap.xml`, and `/posts-sitemap.xml`. A failed lookup is a 503 titled "Unavailable", with no icon and `noindex`, for those same paths.
- A declared hostname is stored lowercase, with at least two labels, using letters, digits, and hyphens. A scheme, path, port, or trailing dot is refused. `localhost`, `*.localhost`, and IP addresses are refused. The platform host, the platform apex, and any subdomain of the platform apex are refused, including every platform subdomain. The same tenant cannot list a hostname twice and cannot use the canonical host as an alias. Clearing the canonical host while an alias remains is refused. Alias hosts are refused when no canonical host is named. There is no cap, and an alias may use any apex.
- Uniqueness covers every canonical host, every alias host, and every platform subdomain. Declaring a hostname claims its registrable apex (`blog.shop.example.co.uk` claims `example.co.uk`) for that tenant until they no longer name a hostname on it. Names the tenant has not typed are not public hosts. Replacing the canonical host drops the previous hostname unless it remains on the alias list. A dropped hostname is an unknown host. Naming a host makes it that role immediately.
- The platform apex-to-`www` redirect stays a platform concern and is unchanged by tenant host resolution.

## Testing Decisions

- One seam: a Playwright request against the running atnd-me app, the same shape as the existing apex-domain redirect end-to-end test. The test creates a tenant, then requests the canonical host, alias hosts, the platform subdomain, and an unknown host.
- A good test asserts the HTTP response a visitor or crawler receives: status, `Location` when the status is 301, canonical link, Open Graph URL, document title, `robots.txt`, and `sitemap.xml`. It does not assert which function built the redirect.
- The request must observe the 301 itself. Following the redirect and checking only the final page hides the alias response.
- Assert the redirect target as `https://<canonical host><path><query>` with no port, including when the test request uses another scheme or a port. Assert the indexed URL the same way, with the query omitted.
- Refusing a hostname, and refusing a hostname on an apex another tenant has claimed, are assertions on the tenant write this suite already uses to arrange a tenant. They are not a second suite and not an admin-UI walkthrough.
- A failed lookup is the same HTTP seam with resolution forced to throw. The response is 503 for the page, `robots.txt`, and the sitemap paths, and the body is not a homepage sitemap.
- Prior art is the apex-domain redirect end-to-end test, which creates a tenant and requests `*.127.0.0.1.nip.io`. Host-resolution unit tests and middleware unit tests are below this seam. Middleware today does not run for `/robots.txt` or paths under `/sitemap`, so a middleware-only test would not prove those 301s.

## Out of Scope

- Admin DNS status, certificate status, and the routing record shown beside them.
- How a customer publishes DNS, including the CNAME to the SaaS target and Apex Proxying addresses.
- Moving existing tenants onto a canonical host, including Bru Grappling's cutover and any Cloudflare redirect already in front of the apex.
- Redirects that preserve old URL paths from the previous Bru Grappling app. The path in this spec is the path the visitor requested.
- Email sending domains, Apple Pay domain registration, and admin login hosts.
- Location subdomains and organisation sub-subdomains.
- Repairing an Open Graph image URL that prefixes the tenant origin onto an already-absolute media URL.
- A trailing-slash policy. The path in an indexed URL is the request path.
- The platform apex redirecting to the platform `www` host.

## Further Notes

- Glossary: `CONTEXT.md`. Indexed URL, canonical host, alias host, platform subdomain, claimed apex, and platform mark are defined there.
- The decisions behind this spec are the resolved tickets under `.scratch/tenant-public-hosts/`. The outline is [What is the outline of the handoff spec?](issues/09-handoff-spec-outline.md).
- Bru Grappling is the acceptance case. The canonical host is `brugrappling.ie`. `www.brugrappling.ie` and `brugrappling.atnd.me` are alias hosts. Stories 50–54 are that case.
- Today the apex redirects to the stored serving hostname, both `www` and the platform subdomain can serve, and an unknown host can emit the platform title and the platform mark. Alias redirects do not run for `/robots.txt` or paths under `/sitemap`. A failed sitemap lookup can emit a homepage sitemap. `/pages-sitemap.xml` and `/posts-sitemap.xml` are built from the platform origin and are not limited to one tenant.
