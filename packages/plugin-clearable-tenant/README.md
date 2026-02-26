# @repo/plugin-clearable-tenant

Payload plugin that replaces `@payloadcms/plugin-multi-tenant`’s tenant selector and provider with a **clearable** tenant selector and root-aware provider. Use it when you want to:

- Clear the tenant on the dashboard to show **aggregate analytics**.
- Edit **root** navbar/footer (no tenant) on the base site.
- Show a **modal** to select a tenant when creating a document in a collection that requires a tenant, instead of redirecting.

Must run **after** `multiTenantPlugin`.

## Install

In your Payload app:

```bash
pnpm add @repo/plugin-clearable-tenant
# or workspace
pnpm add @repo/plugin-clearable-tenant@workspace:*
```

## Use

```ts
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { clearableTenantPlugin } from '@repo/plugin-clearable-tenant'

export default buildConfig({
  plugins: [
    multiTenantPlugin({ tenantsSlug: 'tenants' /* ... */ }),
    clearableTenantPlugin({
      rootDocCollections: ['navbar', 'footer'],
      collectionsRequireTenantOnCreate: ['lessons', 'instructors' /* ... */],
      collectionsCreateRequireTenantForTenantAdmin: ['pages', 'navbar', 'footer'],
      getCookieDomain: () => getPayloadTenantCookieDomain(), // optional, for subdomain
      userHasAccessToAllTenants: (user) => checkRole(['admin'], user),
    }),
  ],
  // ...
})
```

## Options

- **rootDocCollections** – Globals/collections that support a root document (tenant = null). Default: `['navbar', 'footer']`.
- **collectionsRequireTenantOnCreate** – Slugs where creating a document requires a tenant (modal if none selected).
- **collectionsCreateRequireTenantForTenantAdmin** – Slugs where tenant-admin must have a tenant to create (admin can create with no tenant).
- **getCookieDomain** – Optional. For subdomain setups, return cookie domain (e.g. `.example.com`).
- **userHasAccessToAllTenants** – Optional. Used for loading tenant options; default treats user as admin.

## Testing

```bash
pnpm test
```

Unit tests cover clear behavior, path helpers, and plugin config replacement.

### Dev app

A minimal Next + Payload app is included for local testing (SQLite, no external DB):

```bash
pnpm run generate:importmap   # once, or after config changes
pnpm run dev                  # http://localhost:3000/admin
```

Login: `admin@test.com` / `password`. Seed creates 2 tenants for the clearable selector. Config lives in `dev/payload.config.ts`; app routes in `app/(payload)/`.

### E2E tests

E2E tests for the admin tenant selector live in this package. Either start the dev app above, or an app that uses this plugin (e.g. atnd-me) with at least **2 tenants** and a **super admin** user, then run `pnpm test:e2e`. Optionally set `BASE_URL` (default `http://localhost:3000`).

## Exports

- **Main**: `clearableTenantPlugin`, `getEffectiveTenantIdWhenClearing`, `createPathHelpers`, `isTenantRequiredCreatePath`, `isCreateRequireTenantForTenantAdminPath`, `PathHelpersOptions`, `ClearableTenantPluginOptions`
- **rsc**: `ClearableTenantSelector`, `TenantSelectionProviderRootAware`, `GlobalViewRedirectRootAware`
- **client**: `ClearableTenantSelectorClient`, `TenantSelectionProviderRootAwareClient`, `useTenantSelection`, `TenantOption`
