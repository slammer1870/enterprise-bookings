# @repo/bookings-payments — Per-app configuration

The unified plugin supports multiple features. Each app configures only the features it needs and supplies **per-collection overrides** within each feature so that access, fields, and hooks stay app-specific.

## Plugin config shape

```ts
bookingsPaymentsPlugin({
  // Drop-ins: one-off card payment options per class option (Stripe)
  dropIns?: true | {
    enabled: boolean
    paymentMethodSlugs?: string[]
    dropInsOverrides?: { access?, fields?, hooks? }
  },

  // Class pass: pass types, class passes, transactions (class_pass)
  classPass?: true | {
    enabled: boolean
    eventTypesSlug?: string
    adminGroup?: string
    bookingTransactionsOverrides?: { access?, fields?, hooks? }
    classPassesOverrides?: { access?, fields?, hooks? }
    classPassTypesOverrides?: { access?, fields?, hooks? }
  },

  // Payments: Stripe one-off card payments, transactions (stripe)
  payments?: true | {
    enabled: boolean
    enableDropIns?: boolean  // deprecated: use dropIns above
    paymentMethodSlugs?: string[]
    transactionsOverrides?: { access?, fields?, hooks? }
    bookingTransactionsOverrides?: { access?, fields?, hooks? }
  },

  // Membership: plans (memberships), subscriptions, Stripe recurring
  membership?: true | {
    enabled: boolean
    paymentMethodSlugs?: string[]
    plansOverrides?: { access?, fields?, hooks?, admin? }
    subscriptionOverrides?: { access?, fields?, hooks?, admin? }
  },
})
```

## Per-app configuration

- **Enable only what you need**  
  Omit a feature or set `enabled: false` so its collections and endpoints are not added.

- **Users get `stripeCustomerId` by default**  
  When drop-ins, payments, or membership is enabled, the plugin adds a `stripeCustomerId` field (and Stripe customer creation hook) to the Users collection. Ensure a migration adds the `stripe_customer_id` column if your app defines its own Users collection.

- **Overrides live inside each feature**  
  Use `*Overrides` on the feature that owns the collection:
  - `classPass.bookingTransactionsOverrides`, `classPass.classPassesOverrides`, `classPass.classPassTypesOverrides`
  - `dropIns.dropInsOverrides`
  - `payments.transactionsOverrides`, `payments.bookingTransactionsOverrides`
  - `membership.plansOverrides`, `membership.subscriptionOverrides`

- **Backward compatibility**  
  `payments.enableDropIns: true` (with optional `paymentMethodSlugs`) still enables drop-ins when `dropIns` is not set. Prefer setting `dropIns: { enabled: true, ... }` for new config. Drop-ins use card payments only.

## Example: multi-tenant app (atnd-me)

- Class pass + drop-ins + membership; tenant-scoped access on all plugin collections.

```ts
bookingsPaymentsPlugin({
  classPass: {
    enabled: true,
    eventTypesSlug: 'event-types',
    bookingTransactionsOverrides: { access: { read, create, update, delete } },
    classPassesOverrides: { access: { ... } },
    classPassTypesOverrides: { access: { ... } },
  },
  dropIns: {
    enabled: true,
    paymentMethodSlugs: ['event-types'],
    dropInsOverrides: { access: { ... } },
  },
  membership: { enabled: true, paymentMethodSlugs: ['event-types'] },
})
```

## Example: single-tenant with membership (bru-grappling, kyuzo)

- Payments + drop-ins (or `payments.enableDropIns: true`) + membership; custom plans fields.

```ts
bookingsPaymentsPlugin({
  payments: {
    enabled: true,
    enableDropIns: true,  // or dropIns: { enabled: true, paymentMethodSlugs: ['event-types'] }
    paymentMethodSlugs: ['event-types'],
  },
  membership: {
    enabled: true,
    paymentMethodSlugs: [],
    plansOverrides: {
      fields: ({ defaultFields }) => [...defaultFields, { name: 'type', ... }],
    },
  },
})
```

## Example: single-tenant drop-in only (mindful-yard)

- Payments + drop-ins; custom booking access/hooks.

```ts
bookingsPaymentsPlugin({
  payments: {
    enabled: true,
    enableDropIns: true,
    paymentMethodSlugs: ['event-types'],
  },
})
```

## Example: membership + subscriptions (darkhorse-strength)

- Payments (no drop-ins) + membership; custom subscription fields and booking hooks.

```ts
bookingsPaymentsPlugin({
  payments: { enabled: true, enableDropIns: false },
  membership: {
    enabled: true,
    paymentMethodSlugs: ['event-types'],
    subscriptionOverrides: {
      fields: ({ defaultFields }) => [...defaultFields, { name: 'lastCheckIn', ... }],
    },
  },
})
```

Bookings collection customizations (access, fields, hooks) are done via **@repo/bookings-plugin** `bookingOverrides`, not in this plugin.
