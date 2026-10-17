# Tenant public hosts — migration

Status: ready-for-agent

Companion to [Tenant public hosts](spec.md) and [Admin and customer DNS](spec-admin-dns.md). Glossary: `CONTEXT.md` at repo root.

## Problem Statement

Existing tenants store a single serving hostname and an optional apex-redirect flag. The new model uses an explicit canonical host and alias hosts. Most rows can map mechanically; Bru Grappling must flip serving from `www` to the apex in one cutover, and some apexes still use DNS setups that must move before path-preserving origin redirects work.

## Solution

A one-time data migration reads each tenant's legacy fields and writes the canonical host and alias list used by the new declaration. Every row migrates without waiting on customer DNS, except that Bru's **direction flip** (apex serves, `www` and platform subdomain alias) is gated on apex CNAME to the SaaS target and removal of the Cloudflare apex-to-homepage rule. After migration, public behavior follows [spec.md](spec.md); this document does not redefine it.

## User Stories

1. As a platform operator, I want each tenant's stored serving hostname to become the canonical host, so that existing sites keep the same serving name unless we override.
2. As a platform operator, I want the apex to become an alias host when `redirectApex` was on, so that apex-to-www behavior becomes alias-to-canonical after DNS is fixed.
3. As a platform operator, I want tenants with no stored custom domain to keep the platform subdomain as the only canonical host, so that slug-only tenants are unchanged.
4. As a platform operator, I want the platform subdomain to become an alias once a custom canonical host exists, so that declarations match [spec.md](spec.md).
5. As a platform operator, I want row migration to run without waiting on DNS changes, so that schema and declaration are ready before customers fix records.
6. As Bru Grappling's operator, I want the canonical host to become `brugrappling.ie` with `www.brugrappling.ie` and the platform subdomain as aliases, so that acceptance stories 50–54 in [spec.md](spec.md) can hold after cutover.
7. As Bru Grappling's operator, I want one cutover: apex CNAME live and the apex-to-homepage Cloudflare rule removed before `www` begins 301ing to the apex, so that deep apex URLs serve instead of dropping to the homepage.
8. As a platform operator, I want tenants on a disallowed apex A record to migrate their row anyway but require a later DNS move per [spec-admin-dns.md](spec-admin-dns.md), so that data migration is not blocked by legacy DNS.
9. As a platform operator, I want no automatic path rewrites from the old Bru app, so that only requested paths apply ([spec.md](spec.md) out of scope).
10. As a platform operator, I want verification that each row's canonical host, aliases, and platform role match the mapping rules, and Bru's live URLs match acceptance after cutover.

## Implementation Decisions

### Source fields (legacy)

- **`domain`:** stored serving hostname (often `www.example.com`). Becomes the canonical host unless Bru override applies.
- **`redirectApex`:** when true, the registrable **apex** derived from `domain` becomes an **alias host** after migration.
- Migration reads these once per tenant row. It does not define the new admin UI for editing hosts.

### Default row mapping

- **`domain` present:** canonical host = normalized `domain`. If `redirectApex`, alias hosts include the apex of that hostname; otherwise no apex alias from the flag.
- **`domain` absent:** no custom canonical host; platform subdomain remains the canonical host; no custom alias hosts from migration.
- **After any custom canonical host exists:** platform subdomain is an alias host (declaration only; public 301s per [spec.md](spec.md)).
- Row migration does **not** wait on DNS or certificate Active.

### Bru Grappling override

- Canonical host: **`brugrappling.ie`**.
- Alias hosts: **`www.brugrappling.ie`**, plus **`brugrappling.atnd.me`** (platform subdomain).
- After cutover and [spec.md](spec.md) behavior: `https://brugrappling.ie/kids` returns 200 with indexed URL on the apex; `www` and platform subdomain 301 to the same path and query on the apex; `www` does not return 200 for tenant pages.
- SEO equity that already consolidated on the `www` homepage remains on the homepage; migration does **not** add legacy path parity from the previous app.

### DNS prerequisites

| Concern | Rule |
|---------|------|
| Non-Bru rows | Migrate immediately; customer may still use disallowed apex A until they republish per [spec-admin-dns.md](spec-admin-dns.md). |
| Bru cutover gate | Apex **CNAME** to SaaS target published; Cloudflare rule sending apex to `www` **homepage** removed **before** `www` is an alias that 301s to apex with path preserved. |
| Other apexes on anycast A | Must move to allowed routing so origin can issue path-preserving alias 301s; does not block row migration. |

External steps (zone owner, Cloudflare dashboard) belong in the **cutover runbook**, not in the public-host Playwright suite.

### What migration does not do

- Change redirect, canonical link, sitemap, robots, or metadata rules ([spec.md](spec.md)).
- Implement admin DNS list ([spec-admin-dns.md](spec-admin-dns.md)).
- Old Bru URL path parity, email From-domain, Apple Pay, admin login hosts, location/org subdomains.
- Create Cloudflare custom hostnames beyond existing save-time provisioning.

## Testing Decisions

- **Data migration:** integration test or script test on fixture rows — given `domain` / `redirectApex` / slug, assert canonical host, `aliasHosts`, and implied platform subdomain role.
- **Bru override:** explicit case in the same suite — Bru tenant id or slug maps to `brugrappling.ie` and expected aliases regardless of stored `domain`.
- **Cutover:** manual or operational checklist (CNAME live, rule removed); post-cutover smoke uses [spec.md](spec.md) acceptance URLs (HTTP status, `Location`, canonical link) — may be production or staging with real DNS.
- **Not this suite:** duplicating full [spec.md](spec.md) e2e; admin panel DNS status reads.

### Verification checklist (operational)

- [ ] Every tenant: canonical host and alias list match default mapping or Bru override.
- [ ] Tenants with custom canonical: platform subdomain declared alias.
- [ ] Tenants without custom domain: no custom hosts; platform subdomain canonical.
- [ ] Bru: apex CNAME and rule removal complete before alias flip.
- [ ] Bru: spot-check `brugrappling.ie/kids` (200), `www` and `brugrappling.atnd.me` (301 with query), indexed URL on apex.

## Out of Scope

- Public-page behavior definition ([spec.md](spec.md)).
- Admin DNS panel ([spec-admin-dns.md](spec-admin-dns.md)).
- Redirects preserving old Bru app URL paths.
- Email, Apple Pay, admin login hosts; location and organisation subdomains.

## Further Notes

- Decisions: [How do existing tenants move to a canonical host?](issues/05-migrate-existing-tenants.md). Outline: [What is the outline of the migration handoff spec?](issues/16-migration-handoff-outline.md).
- Acceptance stories 50–54 live in [spec.md](spec.md); they validate **after** migration + Bru cutover, not before.
- Legacy public behavior during transition (apex homepage redirect, dual serving hosts) is described in [spec.md](spec.md) Further Notes; migration removes dependence on `domain` / `redirectApex` as the source of truth for serve vs redirect.
