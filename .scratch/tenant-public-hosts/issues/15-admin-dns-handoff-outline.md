# What is the outline of the admin and DNS publishing handoff spec?

Type: grilling
Status: resolved

## Question

[How does admin show DNS and certificate status for each declared host?](08-admin-dns-cert-status.md) and [Which DNS setups can an apex canonical host use?](07-apex-dns-setups.md) decided admin and customer DNS publishing. The public-page [handoff spec](spec.md) deliberately omitted them.

What is the outline of a standalone handoff spec for admin DNS status, certificate status, routing records, and which DNS setups a customer may use — in glossary words, without restating public-page redirect or canonical-link rules?

## Answer

The companion spec stands alone, in glossary words, in six sections: **Allowed routing**, **Default customer DNS**, **Admin host list**, **Statuses**, **Conditional TXT rows**, and **Out of scope**.

**Allowed routing** states which DNS setups a custom public host may use. A labeled hostname uses a CNAME to the SaaS target. An apex uses that CNAME (including providers that flatten it), or A/AAAA records to the Apex Proxying allocated addresses when the platform account has that add-on. An A record at the anycast addresses of the SaaS target is not allowed. The spec does not require buying Apex Proxying. Naming a host still makes it canonical or alias immediately; routing choice does not change which host serves.

**Default customer DNS** is the routing record alone: CNAME to the SaaS target for labeled hosts and for apexes by default; optional Apex Proxying A/AAAA at `@` when allocated addresses are known. Ownership TXT and `_acme-challenge` TXT are an optional before-cutover path for zones not already on Cloudflare; they are not part of the default. On a zone already on Cloudflare, hostname and certificate checks complete from the routing record. The panel does not prescribe TTL. Delegated DCV is not shown.

**Admin host list** replaces the current domain panel and apex panel with one list per tenant, identical for org admin and platform super-admin. Order: canonical host first, alias hosts in declaration order, platform subdomain last. Each custom domain shows its role (canonical or alias). The platform subdomain shows its role only: canonical when it is the only host, alias when a custom canonical host exists. It has no routing record and no statuses. Dropped hostnames leave the list. Statuses are read when the tenant is opened; they are not stored and do not change which host serves. The email-domain panel stays separate.

**Statuses** are two columns per custom domain on the default routing record: DNS status (Cloudflare hostname status) and certificate status (Cloudflare SSL status). Values are Active, Pending, Error, and Unknown. Active DNS: `active` or `active_redeploying`. Active certificate: `active` only (`staging_active` and `backup_issued` stay Pending). Error DNS: `blocked`, `moved`, or `deleted`, with Cloudflare verification errors under DNS when present. Unknown: no custom hostname, unreadable API, or unmapped status; the routing record still shows. Admin does not derive DNS status from live A-record lookups.

**Conditional TXT rows** appear on the same list while a status is not Active and Cloudflare has issued the value: ownership TXT for DNS, each `_acme-challenge` TXT for the certificate, using Cloudflare’s issued name and value. Zones already on Cloudflare show neither. When a status becomes Active, its TXT rows disappear; the routing record remains. An apex with Apex Proxying also lists A and AAAA at `@` to allocated addresses with no second status pair; those rows are absent when addresses are unknown. The SaaS target’s anycast addresses are never shown as customer records.

**Out of scope**: public-page redirects, canonical link, sitemap, tenant metadata on served pages, migration row transforms, email From-domain, Apple Pay, admin login hosts, and location or organisation subdomains.

A follow-on agent can turn this outline into `spec-admin-dns.md` with user stories and testing seams aligned to admin UI and Cloudflare API reads, not Playwright host redirects.
