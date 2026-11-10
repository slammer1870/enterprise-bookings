# What is the outline of the migration handoff spec?

Type: grilling
Status: resolved
Claimed by: cursor-agent

## Question

[How do existing tenants move to a canonical host?](05-migrate-existing-tenants.md) decided migration from stored `domain` / `redirectApex` to the new canonical and alias model, including Bru Grappling's one cutover.

What is the outline of a standalone handoff spec for that migration — in glossary words, without restating public-page behavior already in [spec.md](spec.md)?

## Answer

The companion spec stands alone, in glossary words, in six sections: **Source fields**, **Default row mapping**, **Bru Grappling cutover**, **DNS prerequisites**, **What migration does not do**, and **Verification**.

**Source fields** names only what exists today on a tenant row for migration: one stored serving hostname (`domain`, often `www`) and an optional apex-redirect flag (`redirectApex`). It does not define the new declaration UI; it states that migration reads these fields once to populate canonical host and alias hosts in the new model.

**Default row mapping** applies to every tenant except the Bru declaration override. The stored `domain` becomes the canonical host. When `redirectApex` is on, the tenant's apex (derived from that hostname's registrable apex) becomes an alias host. When `redirectApex` is off, no apex alias is created from the flag. A tenant with no stored `domain` keeps the platform subdomain as the canonical host and names no custom hosts. Once a custom canonical host exists after migration, the platform subdomain is an alias host (public behavior is in [spec.md](spec.md); migration only sets the declaration). Row migration does not wait on customer DNS changes.

**Bru Grappling cutover** is the single declaration override. After migration the canonical host is `brugrappling.ie`. `www.brugrappling.ie` is an alias host. The platform subdomain is an alias host. Indexed URLs that today use `www` and deep links that today hit the apex homepage are handled by the public-page rules after cutover: `www` and the platform subdomain 301 to the same path on the apex; the apex serves. Equity that already consolidated on the `www` homepage stays on the homepage; migration does not add path-rewrite rules for the old app.

**DNS prerequisites** separates row migration from Bru's direction flip. Every other tenant's row can migrate while apex DNS is still on a disallowed anycast A record; the customer must later move that apex to an allowed routing setup ([admin/DNS companion](15-admin-dns-handoff-outline.md)) so the origin can issue path-preserving alias 301s. Bru's flip is one cutover gated on DNS and zone config: the zone owner publishes the apex CNAME to the SaaS target and removes the Cloudflare rule that sends the apex to the `www` homepage before `www` begins 301ing to the apex. Migration docs list those external steps; they are not Playwright assertions in the public-page suite.

**What migration does not do** lists boundaries: no change to public-page redirect, canonical link, sitemap, or metadata rules (see [spec.md](spec.md)); no admin DNS panel behavior; no old Bru Grappling URL path parity; no email, Apple Pay, or admin login hosts; no location or organisation sub-subdomains; no automatic Cloudflare custom-hostname provisioning beyond what already exists.

**Verification** is operational and data checks, not the public-host Playwright seam. Confirm each migrated row: canonical host matches the mapping rules; alias list matches `redirectApex` and Bru override; platform subdomain role matches whether a custom canonical host exists. For Bru, a cutover checklist ties declaration change to apex CNAME live and apex-to-homepage rule removed. Spot-check the acceptance URLs in [spec.md](spec.md) after cutover.

A follow-on agent can turn this outline into `spec-migration.md` with a cutover runbook for Bru and a one-shot data migration description for all rows.
