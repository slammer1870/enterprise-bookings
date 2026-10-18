# What is the outline of the handoff spec?

Labels: wayfinder:grilling
Type: grilling
Status: resolved
Blocked by: [What does the tenant record store for hostnames and Direction?](02-stored-declaration.md), [How does a serving host that is not the canonical host respond?](03-non-canonical-serving-host.md), [What does admin show for the hostname list and Direction?](04-admin-hostname-list.md), [What is the email sending domain?](05-email-sending-domain.md), [How do existing tenants move to a hostname list and Direction?](06-migrate-hostname-list.md), [Which public hosts are registered for Apple Pay?](07-apple-pay-which-hosts.md)

## Question

The destination is one handoff spec. The public-host spec, the admin DNS spec, and the migration note already exist for the single canonical host.

What sections does the new spec have, in order? Say which of those earlier documents it replaces, and which rules it carries without restating.

## Comments

### Round 1

The new spec replaces the public-host spec, the admin DNS spec, and the migration note as the source of which public host serves. It carries, without copying the old stories: bare-hostname rules, redirect shape, indexed URL shape, sitemap contents, robots allow and disallow, unknown host and failed lookup, tenant metadata, routing record and statuses, TXT rows, Apex Proxying, migration not waiting on DNS, the Bru Grappling apex cutover gate, and the platform apex redirect.

Acceptance is Bru Grappling plus one allow-www-and-non-www fixture. The email sending domain is a section. The email-domain panel stays where it is. Panel shape is not a section.

### Round 2

Eight sections, in order: Declaration, Public responses, Admin, Email sending domain, Apple Pay, Migration, Acceptance, Out of scope. Carried rules sit in the section they belong to. The admin DNS spec remains the wording for the routing record, the status table, TXT rows, and Apex Proxying.

## Proposed understanding

One spec replaces [Tenant public hosts](../../tenant-public-hosts/spec.md), [Tenant public hosts — admin and customer DNS](../../tenant-public-hosts/spec-admin-dns.md), and [Tenant public hosts — migration](../../tenant-public-hosts/spec-migration.md) as the source of which public host serves. The admin DNS spec remains the wording for the routing record, the status table, conditional TXT rows, and Apex Proxying rows. The spec states its rules in glossary words. Its sections do not link the scratch tickets.

Carried in the section they belong to, without copying the old stories:

- A declared hostname stays a bare hostname: format, uniqueness across tenants, and a claimed apex.
- A redirect is `https://<host><path><query>` with no port. The origin issues it. Cloudflare proxies the hostname and does not redirect it.
- The indexed URL is `https://<canonical host><path>` with no query and no port. The path is the request path. There is no new trailing-slash rule.
- The sitemap lists `/`, `/search`, `/posts`, each published page, and each published post. `robots.txt` allows `/` and disallows `/admin/` and `/api/`.
- An unknown host is a 404 titled "Not found". A failed lookup is a 503 titled "Unavailable". Neither emits an icon, and both are `noindex`. A resolved tenant keeps its name, description, and site name. No logo means no icon. No page image means no share image. The platform mark is emitted only on a platform host.
- The routing record, DNS status, certificate status, conditional TXT rows, and Apex Proxying rows stay as they are. Statuses do not change which host serves.
- The row migration does not wait on DNS. Bru Grappling's apex still has to CNAME to the SaaS target, and the Cloudflare rule that sends that apex to the `www` homepage still has to be removed, before `www` redirects to the apex.
- The platform apex redirecting to the platform `www` host stays a platform concern.
- Public-host checks are a request against the running app. The 301 is observed on that response. Hostname refusals are checked on the tenant write. A failed lookup is that same request with resolution forced to throw. Admin checks open the tenant and read the rendered list.

Sections, in order:

1. **Declaration.** The tenant record stores the ordered hostname list and one Direction. Canonical host, serving hosts, and alias hosts are derived on read. `domain`, `aliasHosts`, `redirectApex`, and `apexDomain` leave. Direction is allow www and non-www (the default), redirect to www, or redirect to non-www. The canonical host is chosen from the first hostname's registrable domain. A hostname that is neither `www` nor the apex of a pair serves. Every other www/apex pair follows the same Direction. That pair's serving host names the canonical host as the indexed URL. Redirect to www is refused unless that `www` hostname is in the list. Redirect to non-www is refused unless that apex is in the list. The missing hostname is not invented. With no custom hostname, the platform subdomain is the canonical host and the only serving host. Once any custom hostname is named, the platform subdomain redirects to the canonical host. A declared hostname stays a bare hostname. Naming a host gives it that role immediately.

2. **Public responses.** The canonical host returns 200 for `/` and a content path. A serving host that is not the canonical host does the same, with no `noindex`. Its canonical link and Open Graph URL are the indexed URL. Its `/robots.txt` returns 200, with the same allow and disallow rules, and its Sitemap line names the canonical host. Its `/sitemap.xml` returns 301 to the canonical host. Its `/pages-sitemap.xml` and `/posts-sitemap.xml` return 404. An alias returns 301 to its pair partner for every path. `www.other.com/sitemap.xml` redirects to `other.com/sitemap.xml`, which redirects to the canonical host. The carried sentences for redirect shape, indexed URL shape, sitemap contents, robots allow and disallow, unknown host, failed lookup, tenant metadata, and the platform apex redirect live here.

3. **Admin.** The custom domain field, the alias list, and Redirect apex leave the form. One comma-separated hostname field has Direction under it and above the public-host list. The choices are Allow www and non-www, Redirect to www, and Redirect to non-www. The public-host list shows saved hostnames in typed order, then the platform subdomain. The role reads canonical, serving, or alias to its target. The platform subdomain is role only. Saving gives each hostname its derived role immediately. If the selected Direction needs a hostname the list no longer has, the choice stays selected, saving is refused, and the stored Direction stays. The routing record, DNS status, certificate status, conditional TXT rows, and Apex Proxying rows stay as specified in the admin DNS spec. This section does not copy that status table. The email-domain panel stays where it is. Admin checks open the tenant and read the rendered list.

4. **Email sending domain.** The apex of the canonical host. With no custom hostname, the platform apex. Another apex in the list is not one. Direction does not change it. The email-domain panel stays where it is. Panel shape is not specified.

5. **Apple Pay.** Every serving host is an Apple Pay domain. An alias host is not one. The payment method domain is the whole registration. A registered hostname does not host the association file.

6. **Migration.** The custom domain is first. Other aliases follow in stored order, once. `www.example.com` plus stored parent `example.com` is `www.example.com, example.com` with Direction redirect to www. An apex whose `www` is already an alias is the apex, then that `www` host, with Direction redirect to non-www. Bru Grappling is `brugrappling.ie, www.brugrappling.ie` with Direction redirect to non-www. A row with no pair partner gets allow www and non-www. Every row stores a Direction. The refactor removes `domain`, `aliasHosts`, `redirectApex`, and `apexDomain`. The row write does not wait on DNS. Bru Grappling's apex cutover gate is the carried sentence above. After migration, public behavior follows Public responses.

7. **Acceptance.** Bru Grappling: `https://brugrappling.ie/kids` returns 200, and its canonical link, Open Graph URL, and sitemap URL are `https://brugrappling.ie/kids`. `https://www.brugrappling.ie/kids?ref=1` and `https://brugrappling.atnd.me/kids?ref=1` return 301 to `https://brugrappling.ie/kids?ref=1`. The allow-www-and-non-www fixture is `www.example.com, example.com`. `https://www.example.com/kids?ref=1` returns 200 and names `https://example.com/kids`. `https://www.example.com/sitemap.xml` returns 301 to `https://example.com/sitemap.xml`. Redirect to www has no third acceptance case. Public-host checks are the carried request seam.

8. **Out of scope.** Location subdomains and organisation sub-subdomains. Repairing old URL paths. Repairing an Open Graph image URL that prefixes the tenant origin onto an already-absolute media URL. A per-host indexing toggle. Adding hostnames one at a time. The email DNS panel's shape. Admin login hosts.

Confirmed.

## Answer

One spec replaces [Tenant public hosts](../../tenant-public-hosts/spec.md), [Tenant public hosts — admin and customer DNS](../../tenant-public-hosts/spec-admin-dns.md), and [Tenant public hosts — migration](../../tenant-public-hosts/spec-migration.md) as the source of which public host serves. The admin DNS spec remains the wording for the routing record, the status table, conditional TXT rows, and Apex Proxying rows. The spec states its rules in glossary words. Its sections do not link the scratch tickets.

Carried in the section they belong to, without copying the old stories: bare-hostname format, uniqueness, and a claimed apex; redirect shape (`https://<host><path><query>`, no port, origin-issued, Cloudflare does not redirect); indexed URL shape; sitemap contents; robots allow `/` and disallow `/admin/` and `/api/`; unknown host and failed lookup; tenant metadata and the platform mark; migration not waiting on DNS; Bru Grappling's apex cutover gate; the platform apex redirect. Public-host checks are a request against the running app that observes the 301 itself. Hostname refusals are checked on the tenant write. A failed lookup is that same request with resolution forced to throw. Admin checks open the tenant and read the rendered list.

Eight sections, in order:

1. **Declaration.** The tenant record stores the ordered hostname list and one Direction. Canonical host, serving hosts, and alias hosts are derived on read. `domain`, `aliasHosts`, `redirectApex`, and `apexDomain` leave. Direction is allow www and non-www (the default), redirect to www, or redirect to non-www. The canonical host is chosen from the first hostname's registrable domain. A hostname that is neither `www` nor the apex of a pair serves. Every other www/apex pair follows the same Direction. That pair's serving host names the canonical host as the indexed URL. Redirect to www is refused unless that `www` hostname is in the list. Redirect to non-www is refused unless that apex is in the list. The missing hostname is not invented. With no custom hostname, the platform subdomain is the canonical host and the only serving host. Once any custom hostname is named, the platform subdomain redirects to the canonical host. A declared hostname stays a bare hostname. Naming a host gives it that role immediately.

2. **Public responses.** The canonical host returns 200 for `/` and a content path. A serving host that is not the canonical host does the same, with no `noindex`. Its canonical link and Open Graph URL are the indexed URL. Its `/robots.txt` returns 200, with the same allow and disallow rules, and its Sitemap line names the canonical host. Its `/sitemap.xml` returns 301 to the canonical host. Its `/pages-sitemap.xml` and `/posts-sitemap.xml` return 404. An alias returns 301 to its pair partner for every path. `www.other.com/sitemap.xml` redirects to `other.com/sitemap.xml`, which redirects to the canonical host. The carried sentences for redirect shape, indexed URL shape, sitemap contents, robots allow and disallow, unknown host, failed lookup, tenant metadata, and the platform apex redirect live here.

3. **Admin.** The custom domain field, the alias list, and Redirect apex leave the form. One comma-separated hostname field has Direction under it and above the public-host list. The choices are Allow www and non-www, Redirect to www, and Redirect to non-www. The public-host list shows saved hostnames in typed order, then the platform subdomain. The role reads canonical, serving, or alias to its target. The platform subdomain is role only. Saving gives each hostname its derived role immediately. If the selected Direction needs a hostname the list no longer has, the choice stays selected, saving is refused, and the stored Direction stays. The routing record, DNS status, certificate status, conditional TXT rows, and Apex Proxying rows stay as specified in the admin DNS spec. This section does not copy that status table. The email-domain panel stays where it is. Admin checks open the tenant and read the rendered list.

4. **Email sending domain.** The apex of the canonical host. With no custom hostname, the platform apex. Another apex in the list is not one. Direction does not change it. The email-domain panel stays where it is. Panel shape is not specified.

5. **Apple Pay.** Every serving host is an Apple Pay domain. An alias host is not one. The payment method domain is the whole registration. A registered hostname does not host the association file.

6. **Migration.** The custom domain is first. Other aliases follow in stored order, once. `www.example.com` plus stored parent `example.com` is `www.example.com, example.com` with Direction redirect to www. An apex whose `www` is already an alias is the apex, then that `www` host, with Direction redirect to non-www. Bru Grappling is `brugrappling.ie, www.brugrappling.ie` with Direction redirect to non-www. A row with no pair partner gets allow www and non-www. Every row stores a Direction. The refactor removes `domain`, `aliasHosts`, `redirectApex`, and `apexDomain`. The row write does not wait on DNS. Bru Grappling's apex cutover gate is the carried sentence above. After migration, public behavior follows Public responses.

7. **Acceptance.** Bru Grappling: `https://brugrappling.ie/kids` returns 200, and its canonical link, Open Graph URL, and sitemap URL are `https://brugrappling.ie/kids`. `https://www.brugrappling.ie/kids?ref=1` and `https://brugrappling.atnd.me/kids?ref=1` return 301 to `https://brugrappling.ie/kids?ref=1`. The allow-www-and-non-www fixture is `www.example.com, example.com`. `https://www.example.com/kids?ref=1` returns 200 and names `https://example.com/kids`. `https://www.example.com/sitemap.xml` returns 301 to `https://example.com/sitemap.xml`. Redirect to www has no third acceptance case. Public-host checks are the carried request seam.

8. **Out of scope.** Location subdomains and organisation sub-subdomains. Repairing old URL paths. Repairing an Open Graph image URL that prefixes the tenant origin onto an already-absolute media URL. A per-host indexing toggle. Adding hostnames one at a time. The email DNS panel's shape. Admin login hosts.
