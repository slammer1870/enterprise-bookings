# What is the outline of the handoff spec?

Type: grilling
Status: resolved

## Question

Declaration and migration are decided. The spec is public pages only: the host list, redirects between those hosts, the canonical link, the sitemap, and tenant metadata.

What is the outline of that handoff spec? Admin DNS and certificate status stays on [How does admin show DNS and certificate status for each declared host?](08-admin-dns-cert-status.md).

## Comments

### Round 1

The spec has six sections, in order: Hosts, Redirects, Canonical link, Sitemap and robots, Tenant metadata, Acceptance. Robots stays in the sitemap section. Each section states its rule in glossary words. The spec does not link the scratch tickets, and it does not restate admin DNS, the routing record, or the migration procedure.

### Round 2

The canonical link and every sitemap URL are `https://<canonical host><path>` with no query and no port. The alias redirect still preserves the query.

The sitemap lists `/`, `/search`, `/posts`, each published page, and each published post. `robots.txt` allows `/`, disallows `/admin/` and `/api/`, and its Sitemap line is `https://<canonical host>/sitemap.xml`.

An unknown host returns 404 for the page, `/robots.txt`, and `/sitemap`. A failed lookup returns 503 for those paths. Neither emits a homepage sitemap.

Acceptance is Bru Grappling's observable responses after cutover. The spec ends with an Out of scope section covering admin DNS and certificate status, routing records, the migration procedure, old path parity, email, Apple Pay, admin login hosts, location subdomains, and the Open Graph absolute-URL repair. The cutover steps and the historical-equity note stay out.

### Round 3

The Open Graph URL on a served page is the indexed URL. A tenant host publishes one sitemap, `/sitemap.xml`. It does not publish `/pages-sitemap.xml` or `/posts-sitemap.xml`. On an alias host those two paths 301 to the same path on the canonical host, and the canonical host returns 404 for them.

## Proposed understanding

Confirmed.

The spec stands alone, in glossary words. It has seven sections.

1. **Hosts.** A tenant names an optional canonical host and any alias hosts. The platform subdomain is the canonical host until a custom one is named, and an alias host after that. Alias hosts are named only together with a canonical host. A declared hostname is a bare hostname, and a hostname belongs to at most one tenant. Declaring one claims its apex. Naming a host makes it that role immediately. A dropped hostname is an unknown host. This section does not name stored fields.

2. **Redirects.** The origin 301s every request on an alias host to `https://<canonical host><path><query>` with no port. That includes `/robots.txt`, every path under `/sitemap`, `/pages-sitemap.xml`, and `/posts-sitemap.xml`. An alias host serves no response of its own. With no custom canonical host, the platform subdomain serves and there is no alias redirect. The platform apex-to-`www` redirect is a platform concern.

3. **Canonical link.** A page served on the canonical host emits the indexed URL: `https://<canonical host><path>`, with no query and no port.

4. **Sitemap and robots.** Only the canonical host serves `/robots.txt` and `/sitemap.xml`. The sitemap lists `/`, `/search`, `/posts`, each published page, and each published post, each as an indexed URL. `robots.txt` allows `/`, disallows `/admin/` and `/api/`, and its Sitemap line is `https://<canonical host>/sitemap.xml`. `/pages-sitemap.xml` and `/posts-sitemap.xml` are not published; the canonical host returns 404 for them.

5. **Tenant metadata.** A resolved tenant keeps its name, description, and site name. With no logo it emits no icon, and with no page image it emits no share image. The Open Graph URL is the indexed URL. An unknown host is a 404 titled "Not found", with no icon and `noindex`. A failed lookup is a 503 titled "Unavailable", with no icon and `noindex`. The platform mark is emitted only on a platform host.

6. **Acceptance.** Bru Grappling's canonical host is `brugrappling.ie`. `https://brugrappling.ie/kids` returns 200. Its canonical link, Open Graph URL, and sitemap URL are `https://brugrappling.ie/kids`. `https://www.brugrappling.ie/kids` and `https://brugrappling.atnd.me/kids` 301 to that URL and preserve a query.

7. **Out of scope.** Admin DNS and certificate status, routing records, the migration procedure, old path parity, email, Apple Pay, admin login hosts, location subdomains, and repairing an Open Graph image URL that prefixes the tenant origin onto an already-absolute media URL.

An unknown host returns 404 for the page, `/robots.txt`, `/sitemap.xml`, `/pages-sitemap.xml`, and `/posts-sitemap.xml`. A failed lookup returns 503 for those paths. Neither emits a homepage sitemap. The spec adds no trailing-slash rule. The path in an indexed URL is the request path.

## Answer

The spec stands alone, in glossary words, in seven sections: Hosts, Redirects, Canonical link, Sitemap and robots, Tenant metadata, Acceptance, and Out of scope.

Hosts states the target model. A tenant names an optional canonical host and any alias hosts. The platform subdomain is canonical until a custom one is named, then an alias. Alias hosts are named only with a canonical host. A declared hostname is a bare hostname and belongs to at most one tenant. Declaring one claims its apex. Naming a host makes it that role immediately. A dropped hostname is an unknown host. Stored fields are not named.

Redirects: the origin 301s every alias request to `https://<canonical host><path><query>` with no port, including `/robots.txt`, every path under `/sitemap`, `/pages-sitemap.xml`, and `/posts-sitemap.xml`. An alias serves no response of its own. With no custom canonical host, the platform subdomain serves and there is no alias redirect. The platform apex-to-`www` redirect is a platform concern.

The canonical link and the Open Graph URL are the indexed URL, `https://<canonical host><path>`, with no query and no port. The path is the request path. The spec adds no trailing-slash rule.

Only the canonical host serves `/robots.txt` and `/sitemap.xml`. The sitemap lists `/`, `/search`, `/posts`, each published page, and each published post, each as an indexed URL. `robots.txt` allows `/`, disallows `/admin/` and `/api/`, and its Sitemap line is `https://<canonical host>/sitemap.xml`. `/pages-sitemap.xml` and `/posts-sitemap.xml` are not published. The canonical host returns 404 for them.

Tenant metadata keeps the tenant's name, description, and site name. No logo means no icon. No page image means no share image. An unknown host is a 404 titled "Not found", no icon, `noindex`, including `/robots.txt`, `/sitemap.xml`, `/pages-sitemap.xml`, and `/posts-sitemap.xml`. A failed lookup is a 503 titled "Unavailable", no icon, `noindex`, for those same paths. Neither emits a homepage sitemap. The platform mark is emitted only on a platform host.

Acceptance is Bru Grappling. `https://brugrappling.ie/kids` returns 200, and its canonical link, Open Graph URL, and sitemap URL are `https://brugrappling.ie/kids`. `https://www.brugrappling.ie/kids` and `https://brugrappling.atnd.me/kids` 301 to that URL and preserve a query.

Out of scope: admin DNS and certificate status, routing records, the migration procedure, old path parity, email, Apple Pay, admin login hosts, location subdomains, and repairing an Open Graph image URL that prefixes the tenant origin onto an already-absolute media URL.
