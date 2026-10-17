# What are location and organisation subdomains today?

Type: research
Status: resolved
Claimed by: cursor-agent

## Question

[spec.md](spec.md) excludes location subdomains and organisation sub-subdomains from the public hosts spec.

What exists in the codebase and product today, and do they need a decision ticket before we can scope them in or rule them out of this map?

## Answer

**Location “subdomains” (host-based): not implemented.** `apps/atnd-me/docs/subdomain-hierarchy-design.md` describes a future Phase 1 pattern `dublin.saunabusiness.atnd.me` (two subdomain segments → location + tenant). The doc’s implementation note and the multi-tenant plan state that **shipped Phase 7 multi-location uses one platform subdomain per tenant only**. Location is resolved from the **URL path** (`/locations/{branchSlug}`) and/or cookies (`branch-slug` on the public site, `payload-location` in admin), via `getLocationContext.ts`. Middleware sets `tenant-slug` from `platformSubdomainSlug()`, which reads **only the first** label before the platform root (`publicHostOutcome.ts`); a host like `dublin.saunabusiness.atnd.me` would be misread as tenant slug `dublin`, not as location+tenant. There is no `subdomain-prefix` cookie or `getSubdomainContext` in the codebase. Admin may still show a **preview URL** in design docs; that host pattern is not live resolution.

**Organisation sub-subdomains: not implemented.** The same design doc’s Phase 2 (`yogastudio.organisationbusiness.atnd.me`) adds an **Organisations** collection and org-first resolution. There is no `organisations` collection or org resolution under `apps/atnd-me/src` today. Phase 7.5 remains roadmap/future.

**Interaction with tenant public hosts:** The [public hosts spec](spec.md) models **tenant-level** public hosts: one canonical host, alias hosts, and the platform subdomain. Branch/location context does not add hostnames today and does not participate in custom-domain or Cloudflare hostname declaration. Keeping location and organisation sub-subdomains out of the public-host and admin-DNS companion specs is correct until the subdomain hierarchy design is implemented; at that point a **separate** effort should decide whether e.g. `dublin.{tenant}` on the platform root is a distinct public host, an alias, or forbidden—and how that relates to a tenant’s custom canonical host.

**Map recommendation:** No further decision ticket on this follow-on map. Record as **deferred**: out of companion specs; revisit when Phase 1/2 subdomain hierarchy is scheduled. Optional future ticket: “How do location.tenant platform hosts relate to canonical and alias hosts?”

**Sources:** `apps/atnd-me/docs/subdomain-hierarchy-design.md` (lines 10–11, 55–69); `apps/atnd-me/src/utilities/getLocationContext.ts`; `apps/atnd-me/src/utilities/publicHostOutcome.ts` (`platformSubdomainSlug`); `.cursor/plans/multi-tenant_atnd-me_setup_384dabe1.plan.md` (Phase 7 one-subdomain model).
