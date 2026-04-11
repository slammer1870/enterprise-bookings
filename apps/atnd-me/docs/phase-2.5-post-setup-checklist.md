# Phase 2.5 Post-Setup Verification Checklist

Use this checklist after any Stripe Connect or webhook-related change.

## 1) Environment prerequisites

- [ ] `.env` (or test env) includes:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_CONNECT_WEBHOOK_SECRET`
  - `STRIPE_CONNECT_CLIENT_ID`
  - `DATABASE_URI` points to the expected test/local DB
- [ ] The database URI is reachable from the shell and migrations are up to date.

## 2) Run targeted smoke checks

- [ ] Stripe Connect callback path:
  - `pnpm --filter atnd-me exec vitest run --config ./vitest.config.mts tests/int/stripe-connect-callback.int.spec.ts`
- [ ] Stripe Connect webhook path:
  - `pnpm --filter atnd-me exec vitest run --config ./vitest.config.mts tests/int/stripe-connect-webhook.int.spec.ts`
- [ ] Stripe sync + product lifecycle:
  - `pnpm --filter atnd-me exec vitest run --config ./vitest.config.mts tests/int/stripe-plans-proxy.int.spec.ts tests/int/stripe-class-pass-products-proxy.int.spec.ts tests/int/stripe-product-sync.int.spec.ts`
- [ ] Stripe-gated payment methods:
  - `pnpm --filter atnd-me exec vitest run --config ./vitest.config.mts tests/int/payment-methods-require-connect.int.spec.ts`
- [ ] Stripe payment routing + subscriptions:
  - `pnpm --filter atnd-me exec vitest run --config ./vitest.config.mts tests/int/stripe-payment-webhooks.int.spec.ts tests/int/payments-connect-routing.int.spec.ts`
- [ ] Stripe Checkout session creation:
  - `pnpm --filter atnd-me exec vitest run --config ./vitest.config.mts tests/int/stripe-connect-create-checkout-session.int.spec.ts`

## 3) Run focused Stripe-connect unit checks

- [ ] `pnpm --filter atnd-me exec vitest run --config ./vitest.unit.config.mts tests/unit/stripe-connect/env.test.ts tests/unit/stripe-connect/products.test.ts tests/unit/stripe-connect/coupons.test.ts tests/unit/stripe-connect/booking-fee.test.ts`
- [ ] `pnpm --filter atnd-me exec vitest run --config ./vitest.unit.config.mts tests/unit/stripe-connect/charges.test.ts`

## 4) Optional full checkpoint

- [ ] `pnpm --filter atnd-me exec vitest run --config ./vitest.config.mts`
- [ ] Accept known non-fatal Stripe mock noise unless it changes:
  - `Error fetching product from Stripe: Error: No such product...`
  - `Error creating Stripe customer: TypeError: Cannot read properties of undefined (reading 'list')`

## 5) Green signal

- [ ] All required tests above pass.
- [ ] No new regressions in other non-stripe suites.
- [ ] Sync artifacts are correctly written:
  - Tenant onboarding/connect status updates correctly.
  - Stripe product IDs are set on tenant-scoped, Stripe-backed docs when expected.
  - Archive flows mark local delete flags and avoid duplicate sync side-effects.
- [ ] Callback/webhook error cases remain safe (no unhandled crashes, no partial writes).
