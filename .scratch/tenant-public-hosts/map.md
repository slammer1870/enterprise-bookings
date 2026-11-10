## Destination

A handoff spec for tenant public hosts: the tenant names one canonical host that serves pages; every alias host 301s to it and preserves the path and query; the platform subdomain 301s there once a custom canonical host exists; served pages carry that tenant's metadata. Bru Grappling is the acceptance case, with canonical host `brugrappling.ie`. The map is done when nothing is left to decide before implementation.

## Notes

Domain: atnd-me tenant public hosts. Glossary: `CONTEXT.md`.

Skills: grilling and domain-modeling on grilling tickets. Research tickets follow the research skill.

Standing preferences:

- One serving host, the canonical host. Alias hosts 301 and preserve path and query.
- The tenant names the canonical hostname. The platform does not infer it by preferring `www`.
- Bru Grappling's canonical host is the apex `brugrappling.ie`.
- Once a custom canonical host exists, the platform subdomain 301s to it. Until then the platform subdomain is the canonical host.
- This spec is public pages only: host list, redirects between those hosts, canonical link, sitemap, and tenant metadata.
- The search/host symptom and the platform title/favicon symptom are two failures. Bru's live hosts return the tenant title and logo. See [What do Bru Grappling's live hosts return?](issues/01-bru-live-hosts.md).
- Planning only. Do not implement the host model on this map.

Tracker: local markdown under `.scratch/tenant-public-hosts/`. This repo has no `docs/agents/issue-tracker.md`, and `gh` is not authenticated.

## Decisions so far

- [What do Bru Grappling's live hosts return?](issues/01-bru-live-hosts.md) — Apex `brugrappling.ie` 301s to the www homepage and drops the path; `www` and `brugrappling.atnd.me` both serve Bru pages with canonical `https://www.brugrappling.ie`; the host/redirect symptom and the platform title/favicon symptom are two failures, and the brand fallback is not what these hosts return.
- [What does Cloudflare require for an apex canonical host?](issues/02-cloudflare-apex-canonical.md) — An apex can serve on the same fallback origin as alias custom hostnames if it CNAMEs to the SaaS target or uses Enterprise Apex Proxying static IPs; this app instead A-records the apex at zone anycast addresses and 301s it to `domain`.
- [What should a tenant page emit when branding is missing?](issues/03-missing-branding.md) — A tenant with no logo keeps its name and emits no icon and no share image. An unknown host is a 404 titled "Not found". A failed lookup is a 503 titled "Unavailable". Neither uses the platform mark, and both are noindex.
- [How does a tenant declare its canonical host and aliases?](issues/04-declare-canonical-host.md) — The tenant names an optional canonical host and any alias hosts; naming one claims its apex. The platform subdomain is canonical until a custom one is named. A stored `domain` reads as the canonical host.
- [Where does an alias 301 run?](issues/06-alias-redirect-where.md) — The origin 301s every request on an alias host to `https://<canonical host><path><query>`. Cloudflare proxies the alias and does not redirect it.
- [Which DNS setups can an apex canonical host use?](issues/07-apex-dns-setups.md) — An apex public host uses a CNAME to the SaaS target, or Apex Proxying A/AAAA records when the account has that add-on. An anycast A record is outside the spec. The default customer record is the routing record alone.
- [How do existing tenants move to a canonical host?](issues/05-migrate-existing-tenants.md) — A stored `domain` stays the canonical host. Bru Grappling's canonical host becomes `brugrappling.ie`, and `www` 301s to the same path there in one cutover after the apex CNAME is in place. Other rows do not wait on the apex DNS move.
- [How does admin show DNS and certificate status for each declared host?](issues/08-admin-dns-cert-status.md) — Each custom domain shows a CNAME to the SaaS target with a DNS status and a certificate status from Cloudflare. An apex with Apex Proxying also shows the allocated A/AAAA records. The platform subdomain is marked canonical or alias and shows neither status. Statuses do not change which host serves.
- [What is the outline of the handoff spec?](issues/09-handoff-spec-outline.md) — Seven sections, in order: Hosts, Redirects, Canonical link, Sitemap and robots, Tenant metadata, Acceptance, Out of scope. The spec states the public-page rules in glossary words and does not restate admin DNS, routing records, or the migration procedure.

## Not yet specified

## Out of scope

- Redirects that preserve old bru-grappling URL paths. Host identity is in scope; path parity from the old app is not.
- Email From-domain, Apple Pay domain registration, and admin login hosts.
- Location subdomains and organisation sub-subdomains.
- Repairing Open Graph image URLs that prefix the tenant origin onto an already-absolute media URL. [What do Bru Grappling's live hosts return?](issues/01-bru-live-hosts.md) recorded that defect on Bru's pages. It is not a decision about which host is canonical.
