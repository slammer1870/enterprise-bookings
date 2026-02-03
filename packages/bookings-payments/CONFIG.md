# @repo/bookings-payments — Per-app configuration

The unified plugin supports multiple features. Each app configures only the features it needs and supplies **per-collection overrides** within each feature so that access, fields, and hooks stay app-specific.

## Plugin config shape

```ts
bookingsPaymentsPlugin({
  // Drop-ins: one-off payment options per class option (e.g. "Pay at door")
  dropIns?: true | {
    enabled: boolean
    paymentMethodSlugs?: string[]
    acceptedPaymentMethods?: ('cash' | 'card')[]
    dropInsOverrides?: { access?, fields?, hooks? }
  },

  // Class pass: pass types, class passes, transactions (class_pass)
  classPass?: true | {
    enabled: boolean
    classOptionsSlug?: string
    adminGroup?: string
    bookingTransactionsOverrides?: { access?, fields?, hooks? }
    classPassesOverrides?: { access?, fields?, hooks? }
    classPassTypesOverrides?: { access?, fields?, hooks? }
  },

  // Payments: Stripe one-off payments, transactions (stripe)
  payments?: true | {
    enabled: boolean
    enableDropIns?: boolean  // deprecated: use dropIns above
    paymentMethodSlugs?: string[]
    acceptedPaymentMethods?: ('cash' | 'card')[]
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

- **Overrides live inside each feature**  
  Use `*Overrides` on the feature that owns the collection:
  - `classPass.bookingTransactionsOverrides`, `classPass.classPassesOverrides`, `classPass.classPassTypesOverrides`
  - `dropIns.dropInsOverrides`
  - `payments.transactionsOverrides`, `payments.bookingTransactionsOverrides`
  - `membership.plansOverrides`, `membership.subscriptionOverrides`

- **Backward compatibility**  
  `payments.enableDropIns: true` (with optional `paymentMethodSlugs` / `acceptedPaymentMethods`) still enables drop-ins when `dropIns` is not set. Prefer setting `dropIns: { enabled: true, ... }` for new config.

## Example: multi-tenant app (atnd-me)

- Class pass + drop-ins + membership; tenant-scoped access on all plugin collections.

```ts
bookingsPaymentsPlugin({
  classPass: {
    enabled: true,
    classOptionsSlug: 'class-options',
    bookingTransactionsOverrides: { access: { read, create, update, delete } },
    classPassesOverrides: { access: { ... } },
    classPassTypesOverrides: { access: { ... } },
  },
  dropIns: {
    enabled: true,
    paymentMethodSlugs: ['class-options'],
    acceptedPaymentMethods: ['cash', 'card'],
    dropInsOverrides: { access: { ... } },
  },
  membership: { enabled: true, paymentMethodSlugs: ['class-options'] },
})
```

## Example: single-tenant with membership (bru-grappling, kyuzo)

- Payments + drop-ins (or `payments.enableDropIns: true`) + membership; custom plans fields.

```ts
bookingsPaymentsPlugin({
  payments: {
    enabled: true,
    enableDropIns: true,  // or dropIns: { enabled: true, paymentMethodSlugs: ['class-options'] }
    acceptedPaymentMethods: ['card'],
    paymentMethodSlugs: ['class-options'],
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
    acceptedPaymentMethods: ['cash'],
    paymentMethodSlugs: ['class-options'],
  },
})
```

## Example: membership + subscriptions (darkhorse-strength)

- Payments (no drop-ins) + membership; custom subscription fields and booking hooks.

```ts
bookingsPaymentsPlugin({
  payments: { enabled: true, enableDropIns: false, acceptedPaymentMethods: ['card'] },
  membership: {
    enabled: true,
    paymentMethodSlugs: ['class-options'],
    subscriptionOverrides: {
      fields: ({ defaultFields }) => [...defaultFields, { name: 'lastCheckIn', ... }],
    },
  },
})
```

Bookings collection customizations (access, fields, hooks) are done via **@repo/bookings-plugin** `bookingOverrides`, not in this plugin.
