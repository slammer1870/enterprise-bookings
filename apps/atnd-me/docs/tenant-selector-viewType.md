# Where `viewType` Comes From (Plugin TenantSelector)

The multi-tenant plugin’s [TenantSelector](https://github.com/payloadcms/payload/blob/main/packages/plugin-multi-tenant/src/components/TenantSelector/index.client.tsx) uses:

```tsx
<SelectInput
  isClearable={['dashboard', 'list'].includes(viewType ?? '')}
  ...
/>
```

So the clear option only appears when `viewType` is `'dashboard'` or `'list'`.

## Where `viewType` is set

- **Not** from our app config. We don’t pass it.
- The plugin’s **RSC wrapper** receives `viewType` in `props` and forwards it to the client component:
  ```tsx
  // plugin TenantSelector index.tsx
  export const TenantSelector = (props: Props) => {
    const { label, viewType } = props
    return <TenantSelectorClient ... viewType={viewType} />
  }
  ```
- So `viewType` is whatever **Payload’s admin layout** passes when it renders the nav (e.g. `beforeNav` / `beforeNavLinks`). Payload core derives it from the **current route** and injects it as part of `ServerProps` (or similar) into components in that slot.

So in practice:

- On `/admin` (dashboard) → Payload may pass `viewType: 'dashboard'`.
- On `/admin/collections/:slug` (list) → `viewType: 'list'`.
- On `/admin/collections/:slug/:id` (edit) → `viewType: 'document'` (or `'version'`).

Whether a **custom** dashboard (our `views.dashboard.Component`) gets `viewType: 'dashboard'` depends on Payload: if the framework treats “current view is the dashboard” the same for default and custom dashboard, it will pass `'dashboard'`; if it only sets `viewType` for built-in views, it might pass `undefined` for our custom dashboard.

## Can we “assert” viewType for our custom dashboard?

**Not from our config in a meaningful way.**

1. **We don’t render the plugin’s TenantSelector** – Payload does. We only **replace** it with `ClearableTenantSelector` in the plugin array. So we can’t “inject” `viewType` into the plugin’s component from here.

2. **Config only gives static props** – `clientProps` / `serverProps` on the TenantSelector entry (e.g. `enabledSlugs`, `label`) are fixed at config time. `viewType` is **per-request** (current route). Forcing `viewType: 'dashboard'` in config would be wrong on list/document routes.

3. **Asserting it would have to be in Payload** – The only way to “assert” that our custom dashboard is treated as `viewType: 'dashboard'` is for **Payload core** to pass `viewType: 'dashboard'` when the active view is `admin.components.views.dashboard`. That would be a Payload behavior (or feature request), not something we can set in this codebase.

So:

- **If** Payload already passes `viewType: 'dashboard'` on `/admin` for custom dashboard views, we could in theory remove our replacement and rely on the plugin’s selector (and its `SelectInput`) and the clear option would show on the dashboard.
- **If** Payload does not pass `viewType: 'dashboard'` for our custom dashboard, we have two options:
  - Keep **ClearableTenantSelector** (current approach): always show “No tenant”, no dependency on `viewType`.
  - Ask/implement in **Payload** that custom dashboard views receive `viewType: 'dashboard'` so the plugin’s `isClearable` is true on the dashboard.

## Summary

| Question | Answer |
|----------|--------|
| Where does `viewType` come from? | Payload’s admin layout when it renders the nav; it’s derived from the current route and passed as props (e.g. `ServerProps`) to the TenantSelector. |
| Can we assert it in our codebase? | No. We can’t set or override that per-route value from config; only Payload can pass it. |
| What we do instead | We replace the plugin’s TenantSelector with `ClearableTenantSelector`, which always shows “No tenant” and doesn’t depend on `viewType`. |
