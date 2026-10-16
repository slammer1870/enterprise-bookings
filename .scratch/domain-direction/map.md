# Hostname list and Direction

## Destination

A handoff spec for tenant public-host declaration: an ordered hostname list and one Direction replace the custom domain, the alias list, and Redirect apex, and every reader of those fields follows it. The map is done when nothing is left to decide before implementation.

## Notes

Domain: atnd-me tenant public hosts. Glossary: `CONTEXT.md`.

Skills: grilling and domain-modeling on grilling tickets. Research tickets follow the research skill.

Tracker: local markdown under `.scratch/domain-direction/`. This repo has no `docs/agents/issue-tracker.md`. Blocking is a "Blocked by" line in the ticket body.

Standing preferences:

- The tenant names an ordered list of hostnames in one field, separated by commas. Redirect apex is not part of the declaration. The platform subdomain stays assigned from the slug and is not typed in the list.
- Direction is one control for the whole list. It is allow www and non-www, redirect to www, or redirect to non-www. The default is allow www and non-www.
- A hostname that is neither `www` nor the apex of a pair serves. Direction does not redirect it.
- The canonical host is chosen from the first hostname's registrable domain. If Direction is redirect to www and `www` of that domain is in the list, that `www` host is canonical. Otherwise, if that apex is in the list, the apex is canonical. Otherwise the first hostname is canonical.
- Every other www/apex pair follows the same Direction inside the pair. `www.other.com` redirects to `other.com`, and `other.com` serves while naming the canonical host as the indexed URL.
- Redirect to www is refused unless that `www` hostname is in the list. Redirect to non-www is refused unless that apex is in the list. The missing hostname is not invented.
- With no custom hostname named, the platform subdomain is the canonical host and the only serving host. Once any custom hostname is named, the platform subdomain redirects to the canonical host.
- A redirect preserves the path and query. The target is `https://<host><path><query>` with no port. The origin issues it. Cloudflare proxies the hostname and does not redirect it. Carried from [Where does an alias 301 run?](../tenant-public-hosts/issues/06-alias-redirect-where.md).
- A declared hostname stays a bare hostname under the rules in [How does a tenant declare its canonical host and aliases?](../tenant-public-hosts/issues/04-declare-canonical-host.md): format, uniqueness across tenants, and a claimed apex. Declaring a hostname still claims its registrable apex.
- Planning only. This map produces the handoff spec, not the refactor.

## Decisions so far

- [What hostnames does Stripe require for Apple Pay on a site served from more than one hostname?](issues/01-stripe-apple-pay-hostnames.md) — Each hostname that shows Apple Pay is its own payment method domain; `domain_name` is the bare hostname; one registration does not cover another. Stripe's registration guide handles merchant validation and does not tell you to host an association file.
- [What does the tenant record store for hostnames and Direction?](issues/02-stored-declaration.md) — The tenant record stores the ordered hostname list and one Direction. Canonical host, serving hosts, and alias hosts are derived on read. `domain`, `aliasHosts`, `redirectApex`, and `apexDomain` leave the declaration. The hostname list and Direction are the source of which host serves.
- [Which public hosts are registered for Apple Pay?](issues/07-apple-pay-which-hosts.md) — Every serving host is an Apple Pay domain. An alias host is not one. The payment method domain is the whole registration. A registered hostname does not host the association file.
- [How do existing tenants move to a hostname list and Direction?](issues/06-migrate-hostname-list.md) — The custom domain is first; other aliases follow in stored order, once. `www.example.com` plus stored parent `example.com` is `www.example.com, example.com` with Direction redirect to www. An apex whose `www` is already an alias is the apex, then that `www` host, with Direction redirect to non-www. Bru Grappling is `brugrappling.ie, www.brugrappling.ie` with Direction redirect to non-www even while its stored custom domain is `www.brugrappling.ie`. A row with no pair partner gets allow www and non-www. Every row stores a Direction. The refactor removes `domain`, `aliasHosts`, `redirectApex`, and `apexDomain`.
- [What does admin show for the hostname list and Direction?](issues/04-admin-hostname-list.md) — The custom domain field, the alias list, and Redirect apex leave the form. One comma-separated hostname field has Direction under it and above the public-host list: Allow www and non-www, Redirect to www, or Redirect to non-www. Redirect to www can be selected only when `www` of the first hostname's registrable domain is in the list; Redirect to non-www only when that apex is. Both stay visible. A later incomplete pair does not change that, and that hostname serves. If the selected Direction needs a missing hostname, the choice stays selected, saving is refused, and the stored Direction stays. The public-host list shows saved hostnames in typed order, then the platform subdomain, the same list for a platform super-admin and an org admin. Each typed hostname shows its role, a routing record, a DNS status, and a certificate status. The role reads canonical, serving, or alias to its target. The platform subdomain is role only. TXT rows and Apex Proxying rows stay. The email-domain panel stays where it is. The role is assigned on save. DNS status and certificate status are read when the tenant is opened and may still be Pending or Unknown.
- [What is the email sending domain?](issues/05-email-sending-domain.md) — The apex of the canonical host. `www.example.com`, `example.com`, and `mysite.example.com` share `example.com`, including when that apex is not in the list. Direction does not change it. Another apex in the list is not an email sending domain. With no custom hostname, it is the platform apex.

## Not yet specified

- Whether the email DNS panel changes shape. The email sending domain is the apex of the canonical host.

## Out of scope

- Implementing the refactor. This map ends at a handoff spec.
- Location subdomains and organisation sub-subdomains.
- Repairing old URL paths, and repairing Open Graph image URLs that prefix the tenant origin onto an already-absolute media URL.
- The platform's own redirect from the platform apex to the platform `www` host.
- A per-host search-engine indexing toggle. One indexed host is the rule.
- Adding hostnames one at a time. The declaration is one list.
