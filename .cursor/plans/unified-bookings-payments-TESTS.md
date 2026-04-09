# Tests for Unified Bookings-Payments Plugin

This document specifies the tests needed to ensure the consolidated @repo/bookings-payments plugin (memberships + payments-plugin + class-pass + booking-transactions) works correctly, and where each test should live.

---

## 1. Package-level tests: `packages/bookings-payments/__tests__/`

All tests here use vitest. Reuse patterns from [packages/memberships/__tests__](packages/memberships/__tests__), [packages/payments/payments-plugin/__tests__](packages/payments/payments-plugin/__tests__), and [packages/integration-testing](packages/integration-testing): minimal Payload config with the unified plugin, `createDbString` / `setDbString` for DB, `getPayload` for integration tests.

### 1.1 Config and setup

| File | Purpose |
|------|---------|
| `config.ts` | Minimal buildConfig that uses `bookingsPaymentsPlugin` with all features enabled (membership, payments, classPass). Uses postgres adapter and a test DB. Export `config` for use by other test files. |
| `plugin-configs/bookings-payments.ts` | Named configs: `membershipOnly`, `paymentsOnly`, `classPassOnly`, `allEnabled` for testing partial enablement. |

### 1.2 Unit tests (no Payload/DB)

| File | What to test |
|------|---------------|
| `utils/checkClassPass.test.ts` | `checkClassPass()`: returns `{ valid: true }` when user has active pass for tenant and class option has `allowedClassPasses`; returns `{ valid: false }` when no pass, expired pass, zero quantity, or class option does not allow class passes. Use mocked payload or in-memory data. |
| `hooks/decrementClassPassOnBookingConfirmed.test.ts` | Hook behavior when `getClassPassIdToDecrement` returns id vs null: when id returned and status becomes confirmed, quantity decrements and status flips to `used` when quantity hits 0; when null returned, no update to class-passes. Pass a mock `getClassPassIdToDecrement` and assert `req.payload.update` (or equivalent) calls. |

### 1.3 Integration tests (Payload + DB)

| File | What to test |
|------|---------------|
| `plugin.test.ts` | **Plugin registration:** With `membership: { enabled: true }`, config includes plans + subscriptions collections and membership endpoints; with `payments: { enabled: true }`, config includes transactions, booking-transactions, create-payment-intent endpoint; with `classPass: { enabled: true }`, config includes class-passes and booking-transactions. With `classPass` + `payments` both enabled, booking-transactions is present exactly once. **Injection:** For a collection with slug `event-types` and a `paymentMethods` group, when classPass is enabled, the group has `allowedClassPasses`; when membership is enabled and paymentMethodSlugs includes `event-types`, the group has `allowedPlans`. |
| `booking-transactions.test.ts` | **Collection CRUD:** Create a booking-transaction with `booking`, `paymentMethod: 'class_pass'`, `classPassId`; create one with `paymentMethod: 'stripe'`, `stripePaymentIntentId`. Read back and assert shape. **Tenant:** If multi-tenant is in use in the test config, creating with `tenant` set behaves correctly. |
| `decrement-via-transaction.test.ts` | **Transaction-driven decrement:** Create booking, user, lesson, tenant, class-pass (quantity 2). Create booking-transaction with that booking, `paymentMethod: 'class_pass'`, `classPassId: pass.id`. Run the decrement hook’s logic (or fire booking afterChange with status → confirmed). Assert class-pass quantity is 1 and status still active; run again (e.g. second booking or same hook again for same booking id) and assert quantity 0 and status `used`. **No decrement without transaction:** Create another booking and set status to confirmed without creating a booking-transaction; assert no class-pass is updated (either use a different user/pass or assert pass doc unchanged). |
| `createBookingTransactionOnCreate.test.ts` | When a booking is created with `paymentMethodUsed: 'class_pass'` and `classPassIdUsed: <id>`, the “create booking-transaction on create” hook creates a booking-transaction row with that booking, `paymentMethod: 'class_pass'`, `classPassId`. When those fields are missing or not class_pass, no booking-transaction is created. |
| `webhooks/subscription.test.ts` | Port / adapt [packages/memberships/__tests__/webhooks.test.ts](packages/memberships/__tests__/webhooks.test.ts): subscription-created/updated/canceled call the handlers with mocked Stripe events and assert subscriptions/users/plans are updated as expected. Use unified plugin config that has membership enabled. |
| `webhooks/payment-intent-succeeded.test.ts` | Port / adapt [packages/integration-testing/src/payments/payment-intent-succeeded.test.ts](packages/integration-testing/src/payments/payment-intent-succeeded.test.ts): when payment_intent.succeeded includes metadata with bookingIds (or lessonId + customer), bookings are set to confirmed. **New:** Assert a booking-transaction is created with `paymentMethod: 'stripe'` and `stripePaymentIntentId` for each confirmed booking. |
| `endpoints.test.ts` | **Payments:** GET /stripe/customers and POST /stripe/create-payment-intent require auth and behave as in current payments-plugin tests. **Membership:** GET /stripe/plans, POST /stripe/create-checkout-session, etc. return expected shapes or redirects. Use NextRESTClient or direct handler invocation against the built config. |

### 1.4 Where these files live (summary)

```
packages/bookings-payments/
  __tests__/
    config.ts
    plugin-configs/
      bookings-payments.ts
    plugin.test.ts
    booking-transactions.test.ts
    decrement-via-transaction.test.ts
    createBookingTransactionOnCreate.test.ts
    endpoints.test.ts
    utils/
      checkClassPass.test.ts
    hooks/
      decrementClassPassOnBookingConfirmed.test.ts
    webhooks/
      subscription.test.ts
      payment-intent-succeeded.test.ts
  vitest.config.ts   # or re-use repo vitest preset
```

---

## 2. Integration-testing package: `packages/integration-testing/`

Existing tests that target payments or memberships should be updated to run against the unified plugin config.

| File / area | Change |
|-------------|--------|
| [packages/integration-testing/src/payments/payment-intent-succeeded.test.ts](packages/integration-testing/src/payments/payment-intent-succeeded.test.ts) | Switch config to use `bookingsPaymentsPlugin` instead of wiring payments-plugin directly. Add an assertion that a booking-transaction with `paymentMethod: 'stripe'` exists after a booking is confirmed via the webhook. |
| [packages/integration-testing/src/bookings/config.ts](packages/integration-testing/src/bookings/config.ts) | Use `bookingsPaymentsPlugin` when testing booking + payment flows. Ensure booking-transactions collection is present so any “confirm booking via payment” test can assert on it. |
| New: `packages/integration-testing/src/bookings-payments/` (optional) | Add a small suite that builds config with `bookingsPaymentsPlugin({ membership, payments, classPass })` and runs plugin.test.ts–style checks (collections/endpoints present). Keeps integration-testing as the place for “multiple packages together” tests. |

---

## 3. App-level tests: atnd-me

atnd-me uses class-pass and booking-transactions; Stripe Connect and its webhook remain in-app. Tests here guard app-specific behavior and that the app’s use of the unified plugin is correct.

### 3.1 Integration tests: `apps/atnd-me/tests/int/`

| File | What to test |
|------|---------------|
| `stripe-payment-webhooks.int.spec.ts` (extend) | **Already:** tenant from account/metadata, booking status → confirmed. **Add:** When `payment_intent.succeeded` has `metadata.bookingId`, assert a booking-transaction is created with `booking: bookingId`, `paymentMethod: 'stripe'`, `stripePaymentIntentId`. **Add:** When `metadata.type === 'class_pass_purchase'`, class-pass is created and no booking-transaction for a booking (class_pass_purchase is for purchase, not booking confirmation). |
| New: `booking-transactions-decrement.int.spec.ts` | **Scenario 1 – decrement when class_pass transaction exists:** Create tenant, user, lesson, class-pass (quantity 2), booking (pending). Create booking-transaction (booking, `paymentMethod: 'class_pass'`, classPassId). Update booking to confirmed. Assert class-pass quantity is 1; repeat for second “consumption” and assert quantity 0, status `used`. **Scenario 2 – no decrement when only stripe transaction:** Create booking-transaction with `paymentMethod: 'stripe'` for a booking, set booking to confirmed; assert class-pass (if any) is not decremented. **Scenario 3 – no decrement without transaction:** Booking confirmed, no booking-transaction; assert no class-pass doc is updated. |
| New: `class-pass-booking-create-transaction.int.spec.ts` | Create booking via Local API or tRPC with `paymentMethodUsed: 'class_pass'`, `classPassIdUsed: <id>` (and lesson/user/tenant set). Assert one booking-transaction exists for that booking with `paymentMethod: 'class_pass'` and `classPassId`. Omit or use other payment method and assert no such booking-transaction. |

### 3.2 E2E tests: `apps/atnd-me/tests/e2e/`

| File | What to test |
|------|---------------|
| New or extend: `booking-class-pass.e2e.spec.ts` | **Flow:** User with an active class pass books a lesson that allows class passes; booking is created and (in backend) a booking-transaction with `paymentMethod: 'class_pass'` exists; after confirmation (or immediate if UI confirms with class pass), class-pass quantity decrements. Use existing tenant/auth helpers and create a class-pass + class-option with allowedClassPasses, then drive the booking flow and assert pass quantity down by 1. |

---

## 4. App-level tests: kyuzo, darkhorse-strength, bru-grappling, mindful-yard

After migrating to `bookingsPaymentsPlugin`, existing tests must keep passing. Add or adjust tests only where behavior changes.

| App | Where tests live | What to add/ensure |
|-----|------------------|---------------------|
| kyuzo | (If present: `tests/` or `src/__tests__`) | Smoke test that payload config builds with `bookingsPaymentsPlugin({ membership, payments })`. If there are payments or membership integration tests, run them against the new plugin. |
| darkhorse-strength | Same | Same as kyuzo; ensure subscription/booking membership-dropin behavior unchanged. |
| bru-grappling | Same | Same; ensure children + membership/booking flows still pass. |
| mindful-yard | Same | Smoke test with `bookingsPaymentsPlugin({ payments })`; ensure payment/booking tests still pass. |

If an app does not yet have integration tests for payments/memberships, the migration PR can add a single “config builds and collections/endpoints exist” test to avoid regressions.

---

## 5. Test data and isolation

- **DB:** Use a dedicated test DB or schema (e.g. via `createDbString()` and `setDbString()` as in memberships/payments-plugin). Isolate by run or by `beforeEach` cleanup of created entities.
- **Stripe:** Mock Stripe in unit/integration tests (e.g. `vi.mock('@repo/shared-utils', ...)` or mock the Stripe client). E2E may use Stripe test mode or continue to stub at network level.
- **Multi-tenant (atnd-me):** Reuse existing tenant/user/lesson fixtures. For booking-transactions, set `tenant` from the booking’s tenant when creating transactions.

---

## 6. Implementation order for tests

1. Add `packages/bookings-payments/__tests__/config.ts` and `plugin-configs/bookings-payments.ts` once the plugin exists.
2. Add unit tests for `checkClassPass` and for the decrement hook with a mock `getClassPassIdToDecrement`.
3. Add integration tests in the package: `plugin.test.ts`, `booking-transactions.test.ts`, `decrement-via-transaction.test.ts`, `createBookingTransactionOnCreate.test.ts`.
4. Port/adapt payment-intent-succeeded and subscription webhook tests into `packages/bookings-payments/__tests__/webhooks/`.
5. Add/update `packages/integration-testing` to use the unified plugin and assert booking-transaction creation on payment confirm.
6. In atnd-me, add `booking-transactions-decrement.int.spec.ts` and `class-pass-booking-create-transaction.int.spec.ts`; extend `stripe-payment-webhooks.int.spec.ts` for booking-transaction creation.
7. Add atnd-me E2E for “book with class pass → pass decrements” when the flow is implemented.
8. For kyuzo, darkhorse-strength, bru-grappling, mindful-yard, add or run migration smoke tests and any existing payment/membership tests against the unified plugin.

---

## 7. Summary table: tests and locations

| Test focus | Location | Type |
|------------|----------|------|
| Plugin wiring, injection, partial enablement | `packages/bookings-payments/__tests__/plugin.test.ts` | Integration |
| checkClassPass logic | `packages/bookings-payments/__tests__/utils/checkClassPass.test.ts` | Unit |
| Decrement hook (id vs null, quantity/status) | `packages/bookings-payments/__tests__/hooks/decrementClassPassOnBookingConfirmed.test.ts` | Unit |
| Booking-transactions CRUD and tenant | `packages/bookings-payments/__tests__/booking-transactions.test.ts` | Integration |
| Decrement only when transaction says class_pass | `packages/bookings-payments/__tests__/decrement-via-transaction.test.ts` | Integration |
| Create booking-transaction on booking create (class_pass) | `packages/bookings-payments/__tests__/createBookingTransactionOnCreate.test.ts` | Integration |
| Subscription webhooks | `packages/bookings-payments/__tests__/webhooks/subscription.test.ts` | Integration |
| Payment-intent webhook + booking-transaction | `packages/bookings-payments/__tests__/webhooks/payment-intent-succeeded.test.ts` | Integration |
| Endpoints (customers, create-payment-intent, plans, checkout) | `packages/bookings-payments/__tests__/endpoints.test.ts` | Integration |
| atnd-me: webhook creates stripe booking-transaction | `apps/atnd-me/tests/int/stripe-payment-webhooks.int.spec.ts` | Integration |
| atnd-me: decrement only with class_pass transaction | `apps/atnd-me/tests/int/booking-transactions-decrement.int.spec.ts` | Integration |
| atnd-me: create transaction when booking has classPassIdUsed | `apps/atnd-me/tests/int/class-pass-booking-create-transaction.int.spec.ts` | Integration |
| atnd-me: E2E book with class pass → decrement | `apps/atnd-me/tests/e2e/booking-class-pass.e2e.spec.ts` | E2E |
| Other apps: config + plugin | Per-app `tests/` or `src/__tests__` | Integration / smoke |
