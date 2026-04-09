# Subdomain hierarchy: subdomains and sub-subdomains

This document is split into **two phases**:

- **Phase 1 – Multi-location**: One tenant (business) with multiple locations; sub-subdomain = location (e.g. `dublin.saunabusiness.atnd.me`).
- **Phase 2 – Multi-org**: Organisations with multiple branded tenants; sub-subdomain = tenant under org (e.g. `yogastudio.organisationbusiness.atnd.me`).

Root domain is `atnd.me` (or `localhost` in dev). Phase 1 can be shipped alone; Phase 2 builds on it and adds the second interpretation of 2-segment URLs.

**Implementation note (atnd-me Phase 6):** The current multi-location implementation uses **one subdomain only** (tenant). Location is resolved from the **path** (e.g. `/locations/[locationSlug]`) or a **frontend location selector** (cookie/state), not from a sub-subdomain. The 2-segment `location.tenant` host pattern described in this doc is an optional future extension.

---

## Overview: URL patterns by phase

| Host | Phase | Meaning |
|------|-------|--------|
| `atnd.me` | Both | Root / marketing; no tenant |
| `saunabusiness.atnd.me` | Both | **Standalone tenant** (slug `saunabusiness`) |
| `dublin.saunabusiness.atnd.me` | **Phase 1** | **Location** `dublin` under **tenant** `saunabusiness` |
| `yogastudio.organisationbusiness.atnd.me` | **Phase 2** | **Tenant** `yogastudio` under **organisation** `organisationbusiness` |

Phase 1: only 1-segment (tenant) and 2-segment **location.tenant** exist.  
Phase 2: add 2-segment **tenant.org**; resolution order is org-first, then location.tenant.

---

# Phase 1: Multi-location architecture

**Goal**: One business (tenant) with multiple locations; customers can use `location.tenant.atnd.me` to land on a specific location; location-managers get a location-scoped admin; pages stay tenant-wide and are managed only by tenant-admin.

## Phase 1 – Data model

### Locations (new, tenant-scoped collection)

- **Slug**: unique **per tenant** (e.g. `dublin`).
- **Tenant**: relationship to `tenants` (required).
- **Name**, optional **address**, **timezone**, etc.
- URL: `{locationSlug}.{tenantSlug}.atnd.me`.
- **Access**: tenant-scoped (multi-tenant plugin or explicit `where: { tenant: ... }`).
- **Validation**: Compound unique `(tenant_id, slug)` (or `beforeValidate` check).

### Location on timeslots / bookings

- **Timeslots**: add **`location`** (relationship to `locations`, optional). If set, lesson is at that location.
- **Bookings**: location derived from lesson or stored for filtering.
- **StaffMembers / event-types**: add `location` (optional) if they vary by location.

### Pages (and Navbar, Footer) – no location

- Do **not** add a `location` field. Pages stay **tenant-scoped only**.
- **Who manages**: Only **tenant-admin** and super admin. **Location-manager** has **no access** to Pages (or read-only if you prefer).
- **Frontend**: On `dublin.saunabusiness.atnd.me` the site loads the **tenant’s** pages; **location** is used for “Book at this location”, contact info, and which timeslots to show — not for choosing which page document to load.

## Phase 1 – Resolution (2 segments only = location.tenant)

When the host has **two** subdomain segments (Phase 1 only has location.tenant):

1. **Treat as location.tenant**: Look up tenant by `slug = second`; if found, look up location by `slug = first` and `tenant = that tenant`.
2. If found → **tenant + location context**.
3. **Optional fallback**: If location not found, treat as tenant only (second = tenant, first ignored) so `typo.saunabusiness.atnd.me` still shows the tenant site.

No Organisations in Phase 1, so no org lookup.

## Phase 1 – Middleware

- **0 segments**: Clear `tenant-slug` and `subdomain-prefix`.
- **1 segment**: Set **`tenant-slug`** = that segment (unchanged from current behaviour). Clear `subdomain-prefix`.
- **2 segments**: Set **`subdomain-prefix`** = `first.second` (e.g. `dublin.saunabusiness`). Do not set `tenant-slug`; resolution is server-side.

Cookie domain: same as today (e.g. `.atnd.me` or `.localhost`).

## Phase 1 – Server-side resolution (getSubdomainContext)

Return type: `{ tenant, location? }` (no `org` in Phase 1).

1. **Admin override**: If `payload-tenant` cookie is set, resolve tenant by ID; no subdomain resolution. Location can be from `payload-location` if present.
2. **Single segment**: If `tenant-slug` is set (and no `subdomain-prefix`), look up tenant by slug. Return `{ tenant, location: null }`.
3. **Two segments**: If `subdomain-prefix` is set, split into `[first, second]`. Find tenant by `slug = second`; find location by `slug = first` and `tenant = tenant.id`. Return `{ tenant, location }` or `{ tenant, location: null }` with optional fallback (second = tenant only).
4. **Cache** result per-request (e.g. `req.context.subdomainContext`).

Ensure **getTenantContext** uses this when `subdomain-prefix` is present so existing callers still get the tenant.

## Phase 1 – Location-manager role and access

- Add role **`location-manager`** (or model via **`user.locations`** relationship).
- **Access**: Location-managers read/update only docs where `location` is in their assigned locations (and tenant matches). Use a shared access helper.
- **Pages (and Navbar, Footer)**: Allow create/update/delete only for **admin** and **tenant-admin**. For **location-manager**, return `false` (or read-only). Optionally hide Pages in sidebar for location-manager.
- **Admin panel**: Include `location-manager` in `adminRoles` so they can log in; restrict nav and list views to their location(s).

## Phase 1 – Admin dashboard

- **Super admin**: Configuration → **Tenants**, **Locations**. Tenant selector + **location selector** (when tenant has locations). Pages, Timeslots, Bookings scoped by tenant/location.
- **Tenant-admin**: Their tenant only; **Locations** for their tenant (list, create, edit). **Pages** full access for their tenant. Timeslots, Bookings with optional location filter.
- **Location-manager**: No Organisations, no Tenants list, **no Pages**. **Locations**: only their location(s). Timeslots, Bookings: only their location(s).
- **Location selector**: When current tenant has locations, show “All locations” + list (super admin / tenant-admin); location-manager sees only their locations. Store in e.g. `payload-location` cookie.
- **URL preview**: On **Location** edit: “Public URL: https://{location.slug}.{tenant.slug}.atnd.me”. On **Tenant** edit: “Public URL: https://{tenant.slug}.atnd.me”.

## Phase 1 – Implementation checklist

- [ ] Add **Locations** collection (slug, tenant, name, address?, timezone?; slug unique per tenant).
- [ ] Add **location** to timeslots (and optionally bookings, staffMembers, event-types).
- [ ] Middleware: for 2 segments set `subdomain-prefix`; for 1 segment set `tenant-slug`; for 0 clear both.
- [ ] Add **getSubdomainContext(payload, source)** returning `{ tenant, location? }` (no org in P1); wire into getTenantContext when `subdomain-prefix` is set.
- [ ] **Pages (and Navbar, Footer)**: access so only admin and tenant-admin can create/update/delete; location-manager no access (or read-only).
- [ ] Add **location-manager** role and **user.locations**; include in `adminRoles`; access helpers for location-scoped collections.
- [ ] **Location selector** in admin (cookie `payload-location`, filter lists by location when set).
- [ ] URL preview on Tenant and Location edit views.
- [ ] Tests: middleware (1 and 2 segments); resolution (location.tenant, fallback); getTenantContext with subdomain-prefix.
- [ ] E2E: navigate to `location.tenant.localhost`, verify tenant + location context and location-manager sees only their location.

---

# Phase 2: Multi-org architecture

**Goal**: Organisations that own multiple branded tenants (e.g. yoga, gym, sauna); each brand has its own sub-subdomain under the org: `yogastudio.organisationbusiness.atnd.me`. Pages resolve to that org’s tenant (the brand). Optional: org landing page, super-membership later.

## Phase 2 – Data model

### Organisations (new collection)

- **Slug**: unique, used in subdomain (e.g. `organisationbusiness`).
- **Name**, **description**, optional **logo**.
- **No tenant-scoping**: organisations are top-level; tenants belong to an org.
- **Access**: admin only for create/update/delete; read can be public for listing if needed.

### Tenants: add optional `org` relationship

- Add **`org`** (relationship to `organisations`, optional).
- If set: tenant is a “brand” under that org; URL is `{tenantSlug}.{orgSlug}.atnd.me`.
- If null: standalone tenant (or Phase 1 multi-location tenant); URL is `{tenantSlug}.atnd.me`.
- **Slug uniqueness**: Tenant slugs must be globally unique; **and** no tenant slug may equal any organisation slug (so 2-segment resolution is unambiguous). Enforce in validation (e.g. `beforeValidate` on Tenants and Organisations).

### Locations (unchanged from Phase 1)

- Still tenant-scoped; slug unique per tenant. Phase 2 does not add org to locations.

### Pages in Phase 2

- **Pages** resolve to the **organisation’s tenant** (the brand). On `yogastudio.organisationbusiness.atnd.me` the context tenant is “yogastudio”; pages are that tenant’s pages. No “org-level” pages.
- **Who manages**: Tenant-admin for that brand (and super admin). No extra logic: the resolved context tenant is the brand.

## Phase 2 – Resolution (2 segments: org first, then location.tenant)

When the host has **two** subdomain segments, resolve in this order:

1. **Treat second segment as organisation slug**  
   - Look up organisation by `slug = second`.  
   - If found, look up tenant by `slug = first` and `org = that org`.  
   - If found → **tenant + org context** (no location).  
   - Example: `yogastudio.organisationbusiness.atnd.me`.

2. **Else treat second segment as tenant slug**  
   - Look up tenant by `slug = second`.  
   - If found, look up location by `slug = first` and `tenant = that tenant`.  
   - If found → **tenant + location context**.  
   - Example: `dublin.saunabusiness.atnd.me`.

3. **Else**  
   - Optional: fallback to tenant only (second = tenant, first ignored).  
   - Otherwise 404 or marketing.

**Critical**: Organisation slugs and tenant slugs must not overlap (enforce tenant slug ≠ any org slug).

## Phase 2 – Server-side resolution (getSubdomainContext)

Extend the Phase 1 resolver to support org:

- Return type: `{ tenant, location?, org? }`.
- **Two segments**:  
  - **Org-first**: find org by `slug = second`; if found, find tenant by `slug = first` and `org = org.id`; if found return `{ tenant, location: null, org }`.  
  - **Location-tenant**: else find tenant by `slug = second`; if found, find location by `slug = first` and `tenant = tenant.id`; if found return `{ tenant, location, org: null }`.  
  - Optional fallback: else tenant by `slug = second` only → `{ tenant, location: null, org: null }`.
- **Admin override** and **single segment** unchanged; single segment returns no org.

## Phase 2 – Slug validation and reserved slugs

- **Cross-collection**: When saving a **tenant**, ensure `slug` is not used as an **organisation** slug (and optionally vice versa). `beforeValidate` hook.
- **Reserved slugs**: Consider blocking e.g. `admin`, `api`, `www`, `app` for both tenants and orgs.

## Phase 2 – Optional: Organisation landing (1-segment = org)

- If **1-segment** host matches an **organisation** slug (e.g. `organisationbusiness.atnd.me`), show an org landing: “Choose a brand” with links to each tenant under that org. Resolve in getTenantContext: if tenant-slug cookie equals an org slug, return `{ tenant: null, org }` and render org picker. Requires tenant slug ≠ org slug (already required).

## Phase 2 – Admin dashboard

- **Super admin**: **Organisations** in Configuration (list, create, edit, delete). **Tenants**: can assign **org**. **Locations**: unchanged. Organisations column in “Who sees what”; tenant-admin still no access to Organisations.
- **Tenant** edit: When org is set, show “Public URL: https://{tenant.slug}.{org.slug}.atnd.me”.
- **Organisation** edit: Show “Brands (tenants)”: list of tenants in this org with links to their URLs.
- **Breadcrumb**: Optional **Org name** › Tenant name › Location name in header.

## Phase 2 – Implementation checklist

- [ ] Add **Organisations** collection (slug, name, description, logo; access admin-only).
- [ ] Add **Tenants.org** relationship (optional).
- [ ] **Validation**: Tenant slug must not equal any organisation slug; reserved slugs if desired.
- [ ] Extend **getSubdomainContext** to return `{ tenant, location?, org? }` and implement **org-first** then **location.tenant** resolution for 2 segments.
- [ ] **Organisation landing** (optional): 1-segment org slug → org picker page.
- [ ] Admin: Organisations in nav; URL preview on Tenant (with org) and Organisation edit.
- [ ] Tests: resolution order (org first, then location.tenant); slug uniqueness validation.
- [ ] E2E: navigate to `tenant.org.localhost`, verify tenant + org context and correct pages.

---

# Shared (both phases)

## Cookies

| Cookie | When set | Meaning |
|--------|----------|--------|
| `tenant-slug` | 1 subdomain segment | Standalone tenant slug. |
| `subdomain-prefix` | 2 subdomain segments | Raw `first.second`; server resolves to tenant + location (P1) or tenant + location/org (P2). |
| `payload-tenant` | Admin selector | Tenant ID; overrides subdomain (existing). |
| `payload-location` | Admin location selector | Location ID (Phase 1+); optional. |

## Example hosts (atnd.me)

| Host | Phase | Cookie(s) | Resolved context |
|------|-------|-----------|------------------|
| `atnd.me` | Both | (cleared) | No tenant |
| `saunabusiness.atnd.me` | Both | `tenant-slug=saunabusiness` | Tenant “saunabusiness” |
| `dublin.saunabusiness.atnd.me` | 1 | `subdomain-prefix=dublin.saunabusiness` | Tenant “saunabusiness”, location “dublin” |
| `yogastudio.organisationbusiness.atnd.me` | 2 | `subdomain-prefix=yogastudio.organisationbusiness` | Tenant “yogastudio”, org “organisationbusiness” |

## Where pages resolve (summary)

| Architecture | Pages ownership | Pages managed by | Location on Pages? |
|--------------|-----------------|------------------|--------------------|
| Multi-location (Phase 1) | Tenant only | Tenant-admin only | No |
| Organisation (Phase 2) | Tenant (the brand) | Tenant-admin (brand) | N/A |

## Who sees what (by role) – full matrix (Phase 1 + 2)

| Role | Organisations | Tenants | Locations | Pages / Navbar / Footer | Timeslots / Bookings |
|------|----------------|----------|------------|---------------------------|---------------------|
| **Super admin** | All (P2) | All | All | All | All |
| **Tenant-admin** | — | Their tenant(s); edit (no slug/org change in P2) | Their tenant's locations | Their tenant's pages (full) | Their tenant's data; optional location filter |
| **Location-manager** | — | — | Their location(s) | **No access** | Only their location(s) |
| **User** | — | — | — | No admin access | No admin access |

## Recommendations (both phases)

- **Per-request cache**: Store `getSubdomainContext()` result in `req.context.subdomainContext`.
- **Fallback**: When 2 segments and location (and in P2 org) lookup fails, optionally treat as tenant only (second = tenant).
- **E2E helpers**: `navigateToTenantWithLocation(page, tenantSlug, locationSlug, path)` (P1); `navigateToTenantWithOrg(page, tenantSlug, orgSlug, path)` (P2).
- **Migration**: Phase 1 can ship without any org data. Phase 2: no backfill of `org` required for existing tenants; they remain standalone.

## Backward compatibility

- Existing tenants: no `org`, no locations. Single-segment URLs unchanged.
- Phase 1: 2-segment = location.tenant only. Phase 2: 2-segment = org first, then location.tenant.
- No change to existing single-tenant flows in either phase.
