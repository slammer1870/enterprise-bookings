# Tenant refund policy (drop-ins + class passes)

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Outside refund window | **Allow cancel**, no Stripe refund / no class-pass credit restore |
| Unset / empty default | **No automatic refunds** (cancel still allowed; money/credits kept) |
| Policy shape | Default hours + **advanced per–payment-method overrides** |
| Scope | Drop-ins (Stripe) + class passes (credit restore). Subscriptions out of scope for v1 refund action |

## Goal

Tenants configure “free cancellation until N hours before start.” Customer cancel always succeeds; refund/credit restore only when the **effective** window for that booking’s payment method allows it:

1. Resolve effective hours for the payment method (override → default → unset)
2. Refund/restore only if hours are set and `now <= timeslot.startTime - N hours`

## Current gaps

- `cancelBooking` only sets `status: 'cancelled'`
- Stripe refunds only for failed checkout-hold fulfillment
- No class-pass credit restore on cancel
- “24 hours” is UI/FAQ copy only; `lockOutTime` is book-until cutoff, not refund policy

## Schema (admin UX)

Add a `refundPolicy` group on `tenants` (`apps/atnd-me/src/collections/Tenants/index.ts`), near `checkoutLegalDocuments`:

```ts
{
  name: 'refundPolicy',
  type: 'group',
  label: 'Refund policy',
  admin: {
    description:
      'When a customer cancels a confirmed booking, whether drop-in money is refunded or class-pass credit is restored.',
  },
  fields: [
    {
      name: 'defaultWindowHours',
      type: 'number',
      required: false,
      min: 0,
      label: 'Default free cancellation window (hours)',
      admin: {
        description:
          'Applies to all payment methods unless overridden below. Leave empty for no automatic refunds.',
      },
    },
    {
      name: 'advanced',
      type: 'group',
      label: 'Advanced — payment method overrides',
      admin: {
        description:
          'Optional overrides per payment method. Empty override inherits the default. “Never” disables refunds for that method even if a default is set.',
        // Collapsed by default in admin so most tenants only set the default.
        initCollapsed: true,
      },
      fields: [
        {
          name: 'dropIn',
          type: 'group',
          label: 'Drop-in (Stripe)',
          fields: [
            {
              name: 'mode',
              type: 'select',
              defaultValue: 'inherit',
              options: [
                { label: 'Use default', value: 'inherit' },
                { label: 'Custom window', value: 'custom' },
                { label: 'Never refund', value: 'never' },
              ],
            },
            {
              name: 'windowHours',
              type: 'number',
              min: 0,
              admin: {
                condition: (_, siblingData) => siblingData?.mode === 'custom',
                description: 'Hours before start for drop-in Stripe refunds.',
              },
            },
          ],
        },
        {
          name: 'classPass',
          type: 'group',
          label: 'Class pass',
          fields: [
            {
              name: 'mode',
              type: 'select',
              defaultValue: 'inherit',
              options: [
                { label: 'Use default', value: 'inherit' },
                { label: 'Custom window', value: 'custom' },
                { label: 'Never restore credit', value: 'never' },
              ],
            },
            {
              name: 'windowHours',
              type: 'number',
              min: 0,
              admin: {
                condition: (_, siblingData) => siblingData?.mode === 'custom',
                description: 'Hours before start for class-pass credit restore.',
              },
            },
          ],
        },
        // v1: no subscription refund action; field omitted until membership cancel refunds ship.
      ],
    },
  ],
}
```

### Resolution rules

```ts
type MethodOverride = {
  mode?: 'inherit' | 'custom' | 'never'
  windowHours?: number | null
}

function resolveRefundWindowHours(opts: {
  defaultWindowHours?: number | null
  override?: MethodOverride | null
}): number | null {
  const mode = opts.override?.mode ?? 'inherit'
  if (mode === 'never') return null
  if (mode === 'custom') {
    const h = opts.override?.windowHours
    return h == null || Number.isNaN(h) ? null : h
  }
  // inherit
  const d = opts.defaultWindowHours
  return d == null || Number.isNaN(d) ? null : d
}
```

Semantics:

| Config | Effective hours | Refund/restore? |
|--------|-----------------|-----------------|
| Default empty, overrides inherit | `null` | Never |
| Default `24`, overrides inherit | `24` | If ≥ 24h before start |
| Default `24`, drop-in `never` | drop-in `null` | Drop-in never; class pass uses 24 |
| Default empty, class pass custom `12` | class pass `12` | Only class pass, 12h window |
| `custom` with empty hours | `null` | Never (treat as misconfig / no refunds) |
| Hours `0` | `0` | Anytime before start |

Map transaction `paymentMethod`:

- `stripe` (+ drop-in) → `refundPolicy.advanced.dropIn`
- `class_pass` → `refundPolicy.advanced.classPass`
- `subscription` → no automatic refund in v1 (ignore policy)

Run `generate:types` after schema change. Add Postgres migration if required for new tenant columns/JSON.

## Core helpers

Shared pure helpers (e.g. `packages/bookings-payments/src/refund-policy.ts`):

```ts
function resolveRefundWindowHours(...) // as above

function isWithinRefundWindow(opts: {
  refundWindowHours: number | null | undefined
  timeslotStart: Date | string
  now?: Date
}): boolean

function shouldRefundOnCancel(opts: {
  policy: Tenant['refundPolicy'] | null | undefined
  paymentMethod: 'stripe' | 'class_pass' | 'subscription' | null
  timeslotStart: Date | string
  now?: Date
}): boolean
```

`shouldRefundOnCancel`:

1. Pick override from payment method
2. `resolveRefundWindowHours`
3. `isWithinRefundWindow`

## Cancel flow changes

Primary path: `bookings.cancelBooking` in `packages/trpc/src/routers/bookings.ts`.

1. Load booking + timeslot start + tenant `refundPolicy` + transaction
2. Always cancel booking (existing behavior)
3. If `!shouldRefundOnCancel(...)` → done
4. Else:
   - `stripe` + `stripePaymentIntentId` → Connect-aware partial/full refund
   - `class_pass` + `classPassId` → restore 1 credit (reactivate if was `used`)
   - `subscription` / missing tx → no automatic refund (v1)

Staff/admin cancel paths use the **same** helpers. Optional later: `forceRefund` admin override — out of scope for v1.

## Drop-in Stripe refunds

- Reuse Connect pattern from webhook `fulfillCheckoutHold` refund path
- Shared PaymentIntent across multi-qty bookings → **partial refund** by booking share
- Idempotency via transaction `refundedAt` / Stripe refund id
- Platform application fee: Stripe default reverse behavior unless already customized

## Class-pass credit restore

- Increment pass `quantity` by 1 per cancelled booking that used that pass
- If status was `used` and quantity > 0 → `active`
- **v1:** still restore even if pass `expiresAt` has passed (document)
- Guard double-restore (`classPassRestoredAt` on transaction or confirmed→cancelled once)

## UI

- Manage booking cancel dialog: resolve effective policy for that booking’s payment method; honest “will refund / will restore credit / no refund” copy
- Replace hardcoded “24 hours” schedule cancel copy with effective policy (or remove refund promise when none)
- Admin: default field visible; advanced overrides collapsed

## Tests

1. Unit: `resolveRefundWindowHours` — inherit / custom / never / empty default / empty custom
2. Unit: `isWithinRefundWindow` — unset, 0, 24, exact boundary
3. Unit: `shouldRefundOnCancel` — drop-in never + class pass inherit 24; class pass custom 12 + default empty
4. Cancel integration:
   - default unset → no refund/restore
   - default 24 + stripe inside/outside window
   - drop-in never override + inside default window → no Stripe refund
   - class pass custom inside window → credit +1
5. Partial refund + idempotency

## Out of scope (v1)

- Membership/subscription session refunds (advanced override UI omitted until then)
- Partial % refunds / cancellation fees
- Blocking customer cancel outside window
- Legal CMS pages (`checkoutLegalDocuments`) — display-only

## Implementation order

1. Tenant `refundPolicy` group + types (+ migration if needed)
2. Helpers + unit tests (`resolve` / `within` / `shouldRefund`)
3. Class-pass restore on cancel
4. Stripe refund on cancel (Connect + partial + idempotency)
5. Wire into `cancelBooking` (+ shared admin path if cheap)
6. Manage-booking cancel copy using resolved policy
7. E2E smoke / multi-tenant e2e plan §5.3
