# Migrate bru-grappling to atnd-me (tenant + custom blocks)

## Scope

- **In scope:** Bru-grappling becomes a tenant in atnd-me; its custom page blocks are ported into **`@repo/website`** under `blocks/bru-grappling` with descriptive "Bru"-prefixed names and assignable to that tenant; its data (pages, media, navbar/footer globals, users if desired) is migrated and associated with the new tenant.
- **Out of scope:** Children-related functionality (@repo/children, children booking flows, etc.).

---

## 1. Port bru-grappling blocks into the website package

Port bru-grappling’s custom blocks into **`packages/website`** so they can be reused by atnd-me (and any other app). Use a **"Bru" prefix** for each block name and place them under a dedicated folder.

**Location:** `packages/website/src/blocks/bru-grappling/`

**Block naming (descriptive, Bru-prefixed):**

| Bru-grappling block | New name (config export) | Slug (Payload) | Folder |
|---------------------|--------------------------|----------------|--------|
| Hero (custom)        | BruHero                   | `bruHero`      | `BruHero/` |
| About (custom)       | BruAbout                  | `bruAbout`     | `BruAbout/` |
| Schedule (custom)    | BruSchedule               | `bruSchedule`  | `BruSchedule/` |
| Learning             | BruLearning               | `bruLearning`  | `BruLearning/` |
| MeetTheTeam          | BruMeetTheTeam            | `bruMeetTheTeam` | `BruMeetTheTeam/` |
| Testimonials         | BruTestimonials           | `bruTestimonials` | `BruTestimonials/` |
| Contact              | BruContact                | `bruContact`   | `BruContact/` |
| HeroWaitlist         | BruHeroWaitlist           | `bruHeroWaitlist` | `BruHeroWaitlist/` |

**Structure per block (same as existing website blocks):**

- `packages/website/src/blocks/bru-grappling/BruHero/config.ts` – Payload block config (slug: `bruHero`, `interfaceName: 'BruHeroBlock'`, etc.)
- `packages/website/src/blocks/bru-grappling/BruHero/Component.tsx` – React component for frontend
- `packages/website/src/blocks/bru-grappling/BruHero/index.ts` – `export { BruHeroBlock } from './Component'`

Repeat for BruAbout, BruSchedule, BruLearning, BruMeetTheTeam, BruTestimonials, BruContact, BruHeroWaitlist. Source: copy and adapt from [apps/bru-grappling/src/blocks/](apps/bru-grappling/src/blocks/) (config.ts + React component), adjusting imports to use `@repo/website` or `payload-types` as needed. For HeroWaitlist, `relationTo: 'forms'` is fine if the website package (or consuming app) has form builder.

**Barrel export:** Add `packages/website/src/blocks/bru-grappling/index.ts` that exports all Bru block configs and components, then re-export from `packages/website/src/index.ts`:

```ts
// packages/website/src/index.ts additions
export { BruHero, BruAbout, BruSchedule, BruLearning, BruMeetTheTeam, BruTestimonials, BruContact, BruHeroWaitlist } from './blocks/bru-grappling'
export { BruHeroBlock, BruAboutBlock, ... } from './blocks/bru-grappling'  // components
```

---

## 2. Add bru-grappling tenant in atnd-me

- Create a **Tenant** document in atnd-me (e.g. name: "Brú Grappling", slug: `bru-grappling`).
- Set `allowedBlocks` (after step 3) to include the new Bru block slugs: `bruHero`, `bruAbout`, `bruSchedule`, `bruLearning`, `bruMeetTheTeam`, `bruTestimonials`, `bruContact`, `bruHeroWaitlist`, plus any other blocks that tenant should use (e.g. `location`, `faqs`, `formBlock`).
- Optionally set `domain` if the site will be served from a custom domain.

---

## 3. Register Bru blocks in atnd-me and allow them for the bru-grappling tenant

- **Registry:** In [apps/atnd-me/src/blocks/registry.ts](apps/atnd-me/src/blocks/registry.ts), import the Bru block configs from `@repo/website` and add them to `allBlocks`. They will appear in `extraBlockSlugs` (they are not in `defaultBlockSlugs`).
- **Tenant labels:** In [apps/atnd-me/src/collections/Tenants/index.ts](apps/atnd-me/src/collections/Tenants/index.ts), extend `EXTRA_BLOCK_LABELS` with entries for each new slug (e.g. `bruHero: 'Hero (Brú)'`, `bruLearning: 'Learning (Brú)'`, `bruHeroWaitlist: 'Hero Waitlist (Brú)'`, etc.).
- **Frontend:** In [apps/atnd-me/src/blocks/blockComponents.ts](apps/atnd-me/src/blocks/blockComponents.ts), import the Bru block components from `@repo/website` and add mappings: `bruHero`, `bruAbout`, `bruSchedule`, `bruLearning`, `bruMeetTheTeam`, `bruTestimonials`, `bruContact`, `bruHeroWaitlist` → respective components.
- **Pages collection:** No change; the Pages collection already resolves allowed blocks per tenant via `getBlocksForTenant(tenant.allowedBlocks)`.

Run `generate:types` (and `generate:importmap` if needed) in atnd-me after registry changes.

---

## 4. Data migration (bru-grappling DB → atnd-me)

- **Source:** bru-grappling Postgres DB. **Target:** atnd-me Postgres DB with the bru-grappling tenant created and its `id` known.

### 4.1 Relevant collections and mapping

| bru-grappling | atnd-me | Migrate? | Notes |
|---------------|---------|----------|--------|
| **Content & site** | | | |
| `media` | `media` | **Yes** | Build `mediaIdMap: oldId → newId` for layout/block refs. |
| `pages` | `pages` | **Yes** | Add `tenant`, map block slugs, remap media/form refs. |
| Navbar (global) | `navbar` (collection) | **Yes** | One document with `tenant` = bru-grappling; adapt structure. |
| Footer (global) | `footer` (collection) | **Yes** | One document with `tenant` = bru-grappling; adapt structure. |
| `posts` | `posts` | Optional | If blog is needed for tenant; add `tenant` and remap media/author. |
| **Forms** | | | |
| `forms` | `forms` | If pages use forms | Tenant-scoped in atnd-me; build `formIdMap`. |
| `form-submissions` | `form-submissions` | Optional | Only if preserving history; remap `form` and optionally `submittedBy`. |
| **Users & auth** | | | |
| `users` | `users` | Optional | Set `registrationTenant`, add bru-grappling to `tenants` array; map roles. |
| `accounts`, `sessions`, `verifications` | same | Optional | Only if migrating users; Better Auth schema must align. |
| **Booking (if migrating scheduling/payments)** | | | |
| `instructors` | `instructors` | Optional | Add `tenant`. |
| `lessons` | `lessons` | Optional | Add `tenant`; remap `classOption`, `instructor`. |
| `class-options` | `class-options` | Optional | Add `tenant`; skip or map child-specific options per scope. |
| `drop-ins` | `drop-ins` | Optional | Add `tenant`. |
| `class-pass-types` | `class-pass-types` | Optional | Add `tenant`; Stripe product IDs may need re-linking. |
| `class-passes` | `class-passes` | Optional | Add `tenant`; remap `user`, `classPassType`. |
| `plans` | `plans` | Optional | Add `tenant`; Stripe product/price IDs may need re-linking. |
| `discount-codes` | `discount-codes` | Optional | Add `tenant`. |
| `bookings` | `bookings` | Optional | Add `tenant`; remap `user`, `lesson`, `classOption`, payment refs. |
| `subscriptions` | `subscriptions` | Optional | Remap `user`, `plan`, tenant. |
| `transactions` | `transactions` | Optional | Remap related booking/subscription; tenant from context. |
| **Other** | | | |
| `scheduler` (global) | `scheduler` (collection) | Optional | One document per tenant; add `tenant` for bru-grappling. |
| `redirects` | `redirects` | Optional | If atnd-me has redirects collection; add `tenant` if applicable. |

**Out of scope (do not migrate):** Children-specific data (e.g. `type: 'child'` plans/class-options, child-only bookings) unless explicitly decided otherwise.

### 4.2 Migration order (dependency order)

Run in this order so every referenced ID exists in the target:

1. **Tenant** – Create bru-grappling tenant in atnd-me; record `TENANT_ID`.
2. **Media** – Migrate all media; build `mediaIdMap`.
3. **Forms** (if needed) – Migrate forms, set `tenant` = `TENANT_ID`; build `formIdMap`.
4. **Pages** – Migrate pages (use `mediaIdMap`, `formIdMap`), set `tenant`, map block slugs.
5. **Navbar / Footer** – Create one navbar and one footer document with `tenant` = `TENANT_ID`; remap media/link refs using `mediaIdMap`.
6. **Users** (optional) – Migrate users, set `registrationTenant` and `tenants`; build `userIdMap` if migrating booking/form-submissions.
7. **Form submissions** (optional) – Remap `form` via `formIdMap`, `submittedBy` via `userIdMap`.
8. **Booking-related** (optional, in order):
   - Instructors → Lessons → Class-options → Drop-ins → Class-pass-types → Class-passes → Plans → Discount-codes  
   - Then: Bookings (remap user, lesson, classOption) → Subscriptions (remap user, plan) → Transactions (remap by relation).
9. **Scheduler** (optional) – One scheduler doc with `tenant` = `TENANT_ID`.
10. **Posts** (optional) – Migrate with `tenant` and remap media/author via maps.

### 4.3 Per-collection migration steps

**Media**

- Export from bru-grappling `media` (rows + files from upload `staticDir` or storage).
- For each: insert into atnd-me `media` (copy file to atnd-me media dir/S3 and create doc with `tenant` if atnd-me media is tenant-scoped; otherwise no tenant).
- Record `mediaIdMap[oldId] = newId` for use in pages, navbar, footer, blocks.

**Pages**

- Export all `pages` from bru-grappling (include `layout` JSON).
- For each page:
  - Set `tenant` = `TENANT_ID`.
  - For each block in `layout`: change `blockType` using the table: `hero`→`bruHero`, `about`→`bruAbout`, `schedule`→`bruSchedule`, `learning`→`bruLearning`, `meetTheTeam`→`bruMeetTheTeam`, `testimonials`→`bruTestimonials`, `contact`→`bruContact`, `hero-waitlist`→`bruHeroWaitlist`. Leave `formBlock`/`faqs` as-is if slugs match.
  - Recursively in block content: replace any media IDs with `mediaIdMap[oldId]`, form IDs with `formIdMap[oldId]`.
  - Slug: keep or derive; atnd-me uses tenant-scoped slug uniqueness (e.g. `tenantScopedSlugField`), so same slug under bru-grappling tenant is valid.
- Insert via Payload Local API or direct DB; prefer Local API so hooks (e.g. revalidate) run.

**Navbar / Footer**

- bru-grappling has one global Navbar and one Footer. In atnd-me these are collection documents with optional `tenant`.
- Create one `navbar` doc: set `tenant` = `TENANT_ID`, copy nav items; remap `logo` (media) and any link/upload refs with `mediaIdMap`.
- Create one `footer` doc: set `tenant` = `TENANT_ID`, copy structure; remap media/link refs.

**Users**

- Export users; for each create in atnd-me with same email/name/etc. Set `registrationTenant` = `TENANT_ID` and ensure bru-grappling tenant is in the `tenants` array. Map roles to atnd-me roles (`admin`, `tenant-admin`, `user`). Passwords must be re-set or use same hash if Better Auth schema matches.
- Build `userIdMap` for bookings, form-submissions, class-passes, subscriptions.

**Booking collections (optional)**

- For each collection: add `tenant` = `TENANT_ID` to every document; remap relationship IDs using the maps (e.g. lessons → `classOption`, `instructor`; bookings → `user`, `lesson`, `classOption`). Stripe-related IDs (plans, class-pass-types, etc.) may need re-sync or manual mapping if Connect account changes.

### 4.4 ID mapping strategy

- Maintain in-memory (or JSON file) maps: `mediaIdMap`, `formIdMap`, `userIdMap`, and optionally `instructorIdMap`, `lessonIdMap`, `classOptionIdMap`, `planIdMap`, `classPassTypeIdMap` as you create target documents.
- When writing a document that has relationship fields, replace every source ID with the corresponding map value; if an ID is missing from the map, skip or log and decide (e.g. optional refs can be nulled).
- For blocks and rich text: walk the JSON and replace any `value.id` (or relation structure) that points to media/forms/users with the new ID.

### 4.5 Migration script structure

- **Tooling:** One-off Node/tsx script (or Payload migration file) that:
  - Connects to bru-grappling DB (read-only) and atnd-me (Payload `getPayload()` + Local API, or direct Postgres with care for hooks).
  - Accepts `--dry-run` (log what would be done, no writes) and `TENANT_ID` (or slug to resolve).
- **Phases:** Implement phases 1–10 in order (Section 4.2); each phase can be a function that returns or updates the ID maps.
- **Validation:** After each collection: assert counts (e.g. total docs in source vs created in target for that collection); spot-check a few docs (e.g. one page’s layout has correct blockTypes and remapped IDs).
- **Rollback:** Either run against a copy of atnd-me DB and swap, or tag migrated docs (e.g. custom field or metadata) so a rollback script can delete by `tenant` = `TENANT_ID` and re-run later. Avoid deleting non-migrated data.

### 4.6 Summary of Section 4 steps (concise)

1. **Tenants:** Ensure bru-grappling tenant exists; note `id`.
2. **Media:** Export → import; build `mediaIdMap`.
3. **Pages:** Export; set `tenant`; map block slugs; remap media/form IDs; import.
4. **Navbar/Footer:** Create one each with `tenant`; remap refs.
5. **Users (optional):** Migrate; set `registrationTenant` + `tenants`; build `userIdMap`.
6. **Forms / form-submissions (optional):** Migrate with `tenant`; use `formIdMap` (and `userIdMap`) for refs.
7. **Booking collections (optional):** In dependency order; add `tenant` and remap all relationship IDs.
8. **Scheduler / Posts (optional):** One scheduler doc; posts with `tenant` and remap.

**Implementation:** One-off migration script (Node/tsx) that connects to both DBs (or uses Payload Local API for atnd-me), reads bru-grappling data, applies the block slug mapping and tenant id, maintains ID maps, and writes in the order above.

---

## 5. CI / config cleanup (optional)

- In [.github/workflows/ci.yml](.github/workflows/ci.yml), remove or adjust the `bru-grappling` job if the standalone app is retired.
- Update docs (e.g. E2E_MIGRATION_GUIDE.md, CI_E2E_TESTING.md) to state that bru-grappling is now a tenant of atnd-me.

---

## 6. Order of operations

1. Port Bru blocks into `packages/website/src/blocks/bru-grappling/` and export from the website package (Section 1).
2. In atnd-me: register Bru blocks in the registry, add `EXTRA_BLOCK_LABELS`, wire block components (Section 3).
3. Run `generate:types` (and `generate:importmap` if needed) in atnd-me.
4. Create bru-grappling tenant and set `allowedBlocks` (Section 2).
5. Run the data migration script (Section 4): follow migration order in **4.2**, use ID maps in **4.4**, and script structure in **4.5**.
6. Optionally update CI and docs (Section 5).

---

## Summary

- **Website package:** New blocks under `packages/website/src/blocks/bru-grappling/` with "Bru"-prefixed names (BruHero, BruAbout, BruSchedule, BruLearning, BruMeetTheTeam, BruTestimonials, BruContact, BruHeroWaitlist); each with config + Component; exported from `@repo/website`.
- **atnd-me:** Import and register those blocks in the block registry and blockComponents; add labels in Tenants; create bru-grappling tenant with `allowedBlocks` including the new slugs.
- **Data:** Migrate all relevant collections in dependency order (Section 4.2): media → forms (if needed) → pages (block slug mapping + ID remap) → navbar/footer → optionally users, form-submissions, booking collections (instructors, lessons, class-options, etc.), scheduler, posts. Use ID maps (4.4) and the script structure (4.5) with dry-run and validation.
- **Out of scope:** Children-related functionality.
