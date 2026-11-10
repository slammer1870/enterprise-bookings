## Destination

Companion handoff specs for everything listed under **Out of scope** in [tenant public hosts](spec.md), plus the admin DNS and migration material the first map decided but deliberately kept out of that spec. The map is done when each in-scope companion has a ready-for-agent spec (or a conscious deferral with a one-line reason), and nothing material is left undecided.

## Notes

Domain: atnd-me tenant public hosts — follow-on to the public-page spec ([map](map.md), [spec](spec.md)). Glossary: `CONTEXT.md`.

Skills: grilling and domain-modeling on grilling tickets. Research tickets follow the research skill.

Standing preferences:

- Public-page host behavior stays in [spec.md](spec.md); this effort does not reopen it.
- [How does admin show DNS and certificate status for each declared host?](issues/08-admin-dns-cert-status.md), [Which DNS setups can an apex canonical host use?](issues/07-apex-dns-setups.md), and [How do existing tenants move to a canonical host?](issues/05-migrate-existing-tenants.md) already hold the decisions for admin DNS, customer routing records, and migration; companion specs should restate them in glossary words, not re-litigate.
- Planning only unless a ticket is explicitly `task`.

Tracker: local markdown under `.scratch/tenant-public-hosts/`. Parent map: [map.md](map.md).

## Decisions so far

- [What is the outline of the admin and DNS publishing handoff spec?](issues/15-admin-dns-handoff-outline.md) — Six-section companion spec: allowed routing, default customer DNS, admin host list, statuses, conditional TXT rows, and out of scope; restates [07](issues/07-apex-dns-setups.md) and [08](issues/08-admin-dns-cert-status.md) in glossary words.
- [What is the outline of the migration handoff spec?](issues/16-migration-handoff-outline.md) — Six sections: source fields, default row mapping, Bru cutover, DNS prerequisites, boundaries, and verification; restates [05](issues/05-migrate-existing-tenants.md).
- [What are location and organisation subdomains today?](issues/19-location-and-org-subdomains.md) — Host-based location.tenant and org sub-subdomains are design-only; shipped product uses one tenant subdomain plus path/cookie location; defer any public-host interaction until subdomain hierarchy ships.
- [What is in scope for email, Apple Pay, and admin login hosts?](issues/18-ancillary-hosts-email-apple-pay-admin.md) — Deferred, no companion spec. Email sending domain is the custom canonical host with a leading `www` removed, or the platform address when none is named. Apple Pay domain is the apex when a custom canonical host is named. Admin login is not a separate host; an alias 301 includes `/admin`.
- [How do we repair the Open Graph absolute URL bug?](issues/20-og-image-absolute-url-repair.md) — Deferred outside tenant public hosts. When the media URL is already absolute, the share image is that URL. No handoff spec.

## Handoff specs

- [Tenant public hosts — admin and customer DNS](spec-admin-dns.md) — done
- [Tenant public hosts — migration](spec-migration.md) — ready-for-agent

## Not yet specified

- Trailing-slash policy and platform apex → platform `www` — likely remain permanently out of this destination unless redrawn.

## Out of scope

- Implementing host resolution, redirects, or sitemap behavior (covered by [spec.md](spec.md) and build tickets 10–14).
- Changing the platform apex → platform `www` redirect (platform concern; unchanged by tenant host resolution).
- Location and organisation sub-subdomains on the platform host (not implemented; see [What are location and organisation subdomains today?](issues/19-location-and-org-subdomains.md)) until subdomain hierarchy work is scheduled.
- Redirects that map paths from the previous Bru Grappling app onto current paths. The public-page spec already keeps the path the visitor requested, and migration does not add those rewrites. See [Do we preserve old Bru Grappling URL paths?](issues/17-old-bru-path-parity.md).
- Email sending domain, Apple Pay domain registration, and a separate admin login host. No companion spec in this map. See [What is in scope for email, Apple Pay, and admin login hosts?](issues/18-ancillary-hosts-email-apple-pay-admin.md).
- Repairing a share image that prefixes the tenant origin onto an already-absolute media URL. When that media URL is already absolute, the share image is that URL. Not a public-host decision. See [How do we repair the Open Graph absolute URL bug?](issues/20-og-image-absolute-url-repair.md).
