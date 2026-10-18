# Tenant public hosts — admin and customer DNS

Status: done

Companion to [Tenant public hosts](spec.md). Glossary: `CONTEXT.md` at repo root (`routing record`, `DNS status`, `certificate status`, `canonical host`, `alias host`, `platform subdomain`, `custom domain`).

## Problem Statement

Org admins today use separate domain and apex panels. DNS and certificate progress are unclear, and apex guidance can point at routing setups the public-host model does not allow. Status is easy to confuse with which host serves pages; naming a host already takes effect immediately on the public site.

## Solution

One admin list shows every public host for the tenant: role, the default routing record for each custom domain, live DNS status and certificate status from Cloudflare, and optional TXT rows only while Cloudflare still needs them. The platform subdomain appears with its role only. Customer-facing DNS is the routing record (CNAME to the SaaS target, or Apex Proxying A/AAAA when allocated). Statuses are read when the tenant is opened; they do not change which host serves.

## User Stories

1. As an org admin, I want one list of my tenant's public hosts, so that canonical, alias, and platform roles are visible together.
2. As an org admin, I want the canonical host listed first and aliases in the order I named them, so that the serving host is obvious.
3. As a platform super-admin, I want the same host list as an org admin, so that support sees what the customer sees.
4. As an org admin, I want each custom domain to show a CNAME to the SaaS target as its default routing record, so that I know what to publish in DNS.
5. As an org admin, I want the DNS host shown as `@` for an apex and as the labels in front of the claimed apex otherwise, so that the record matches my DNS provider.
6. As an org admin, I want DNS status and certificate status as separate columns on that routing record, so that I can see hostname acceptance and TLS issuance independently.
7. As an org admin, I want statuses labeled Active, Pending, Error, or Unknown, so that I can tell at a glance whether a host is ready.
8. As an org admin, I want Cloudflare verification errors under DNS status when present, so that I can fix a blocked hostname.
9. As an org admin, I want the routing record to stay visible when status is Unknown, so that I still know what to configure.
10. As an org admin, I want an ownership TXT row only while DNS status is not Active and Cloudflare has issued it, so that I am not shown obsolete verification steps.
11. As an org admin, I want each `_acme-challenge` TXT row only while certificate status is not Active and Cloudflare has issued it, so that certificate validation is actionable.
12. As an org admin on a zone already on Cloudflare, I want no ownership or `_acme-challenge` TXT rows in the default view, so that the panel stays minimal.
13. As an org admin with Apex Proxying, I want A and AAAA rows at `@` to the allocated addresses on an apex, with no second status pair, so that I can use apex A records when my account allows it.
14. As an org admin, I want the SaaS target's anycast addresses never shown as records I should create, so that I am not steered toward a disallowed setup.
15. As an org admin, I want an apex canonical host to be allowed to use a CNAME to the SaaS target (including DNS providers that flatten it), so that the default apex setup matches Cloudflare for SaaS.
16. As an org admin, I want an A record at the anycast addresses of the SaaS target refused as guidance, so that disallowed apex setups are not recommended.
17. As an org admin, I want the platform subdomain marked canonical when it is my only host, and alias when I have named a custom canonical host, with no routing record or statuses, so that assigned hosts are not confused with custom domains.
18. As an org admin, I want a dropped hostname to leave the list, so that the panel matches my declaration.
19. As an org admin, I want DNS and certificate status refreshed when I open the tenant, and not saved as the source of which host serves, so that naming a host still works before DNS is Active.
20. As an org admin, I want the email-domain panel to stay separate from this list, so that sending domains are not mixed with public page hosts.

## Implementation Decisions

### Allowed routing

- A **labeled** custom public host uses a **CNAME** to the SaaS target.
- An **apex** custom public host uses that same CNAME (including providers that flatten it), or **A/AAAA** records to the **Apex Proxying** allocated addresses when the platform account has that add-on.
- An **A record at the anycast addresses of the SaaS target** is not an allowed setup. The panel must not present those addresses as customer records.
- The spec does not require purchasing Apex Proxying.
- Which host serves is the tenant's declaration ([spec.md](spec.md)); routing choice does not change canonical vs alias.

### Default customer DNS

- The **default** published DNS is the **routing record** alone: CNAME to the SaaS target for labeled hosts and for apexes unless Apex Proxying A/AAAA is shown.
- **Ownership TXT** and **`_acme-challenge` TXT** are an optional before-cutover path for zones **not** already on Cloudflare; they are not part of the default.
- On a zone already on Cloudflare, hostname and certificate checks complete from the routing record.
- The panel does not prescribe TTL.
- **Delegated DCV** is not shown.

### Admin host list

- Replaces the current **domain panel** and **apex panel** with one list per tenant.
- **Order:** canonical host first, alias hosts in declaration order, platform subdomain last.
- Each **custom domain** shows: role (canonical or alias), default routing record (CNAME), DNS status, certificate status on that record.
- **Platform subdomain:** role only (canonical when no custom canonical host; alias when a custom canonical host exists). No routing record, no DNS status, no certificate status.
- Statuses are fetched when the tenant is opened; they are **not** persisted on the tenant row and **do not** change which host serves.
- Dropped hostnames are absent from the list.

### Statuses

- **DNS status** is Cloudflare custom hostname status for that hostname.
- **Certificate status** is Cloudflare SSL status for the same hostname.
- Admin does **not** derive DNS status from live A-record lookups.

| UI value | DNS (hostname) | Certificate (SSL) |
|----------|----------------|-------------------|
| Active | `active`, `active_redeploying` | `active` only |
| Pending | `pending` | issuance in progress, including `staging_active`, `backup_issued` |
| Error | `blocked`, `moved`, `deleted` | — |
| Unknown | no custom hostname, API unreadable, unmapped hostname status | certificate status outside Active and Pending |

- Cloudflare verification errors appear under **DNS status** when present.
- Any certificate status outside Active and Pending maps to **Unknown** unless covered by Pending above.

### Conditional TXT rows

- While **DNS status** is not Active and Cloudflare has issued an ownership value, show that **TXT** (name and value from Cloudflare).
- While **certificate status** is not Active and Cloudflare has issued **`_acme-challenge`** values, show each **TXT** row (name and value from Cloudflare).
- When a status becomes Active, remove its TXT rows; keep the routing record.
- For an apex with Apex Proxying, also show **A** and **AAAA** at `@` to allocated addresses when known; no second DNS/certificate column pair on those rows. Omit A/AAAA rows when allocated addresses are unknown.

## Testing Decisions

- **Primary seam:** opening a tenant in admin (org admin and super-admin) and asserting the rendered host list: order, roles, routing record host labels, status labels, presence/absence of TXT and Apex Proxying rows.
- **Cloudflare:** integration or contract tests mock the custom hostname / SSL API; tests map raw Cloudflare statuses to Active, Pending, Error, and Unknown per the table above.
- **Not this suite:** Playwright public-host 301s, canonical link, or sitemap behavior ([spec.md](spec.md) e2e). Declaration validation remains on tenant write tests.
- **Regression:** platform subdomain row never shows routing record or statuses; anycast SaaS target addresses never appear as recommended records.

## Out of Scope

- Public-page redirects, canonical link, sitemap, robots, and tenant metadata on served pages ([spec.md](spec.md)).
- One-shot **migration** of stored `domain` / `redirectApex` ([spec-migration.md](spec-migration.md)).
- Email **From** domain panel, Apple Pay domain registration, admin login hosts.
- Location subdomains and organisation sub-subdomains.
- Provisioning or deleting Cloudflare custom hostnames beyond what existing hooks already do when a host is saved.

## Further Notes

- Decisions: [Which DNS setups can an apex canonical host use?](issues/07-apex-dns-setups.md), [How does admin show DNS and certificate status for each declared host?](issues/08-admin-dns-cert-status.md). Outline: [What is the outline of the admin and DNS publishing handoff spec?](issues/15-admin-dns-handoff-outline.md).
- Public behavior when DNS is Pending: [spec.md](spec.md) story 21 — naming still makes the host that role immediately.
