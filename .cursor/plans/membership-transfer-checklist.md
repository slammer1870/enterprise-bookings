# Full Membership Plugin Transfer Checklist

Everything from `@repo/memberships` that should move into `@repo/bookings-payments` so the membership branch is self-contained and the memberships package can be deleted.

---

## 1. Plugin / Config

| Item | Source | Target in bookings-payments |
|------|--------|-----------------------------|
| Plugin logic | `packages/memberships/src/plugin/index.ts` | Inline into `packages/bookings-payments/src/plugin/index.ts` when `membership?.enabled` (users mod, plans/subscriptions collections, endpoints, paymentMethods.allowedPlans + join injection) |
| Config types | `packages/memberships/src/types.ts` (`MembershipsPluginConfig`) | Merge into `packages/bookings-payments/src/types.ts` under `membership` (or add `src/membership/types.ts`) |

---

## 2. Collections

| Collection / Mod | Source | Target |
|------------------|--------|--------|
| **plans** | `src/collections/plans.ts` (`generatePlansCollection`) | `src/membership/collections/plans.ts` |
| **subscriptions** | `src/collections/subscriptions.ts` (`generateSubscriptionCollection`) | `src/membership/collections/subscriptions.ts` |
| **users** (subscription fields + hooks) | `src/collections/users.ts` (`modifyUsersCollection`) | `src/membership/collections/users.ts` |

---

## 3. Endpoints

| Endpoint | Source | Target |
|----------|--------|--------|
| GET /stripe/plans | `src/endpoints/plans.ts` (`plansProxy`) | `src/membership/endpoints/plans.ts` |
| GET /stripe/subscriptions | `src/endpoints/subscriptions.ts` (`subscriptionsProxy`) | `src/membership/endpoints/subscriptions.ts` |
| POST /stripe/create-checkout-session | `src/endpoints/create-checkout-session.ts` | `src/membership/endpoints/create-checkout-session.ts` |
| POST /stripe/create-customer-portal | `src/endpoints/create-customer-portal.ts` | `src/membership/endpoints/create-customer-portal.ts` |
| POST /stripe/sync-stripe-subscriptions | `src/endpoints/sync-stripe-subscriptions.ts` | `src/membership/endpoints/sync-stripe-subscriptions.ts` |

---

## 4. Webhooks

| Webhook | Source | Target |
|---------|--------|--------|
| subscriptionCreated | `src/webhooks/subscription-created.ts` | `src/membership/webhooks/subscription-created.ts` |
| subscriptionUpdated | `src/webhooks/subscription-updated.ts` | `src/membership/webhooks/subscription-updated.ts` |
| subscriptionCanceled | `src/webhooks/subscription-canceled.ts` | `src/membership/webhooks/subscription-canceled.ts` |
| subscriptionPaused | `src/webhooks/subscription-paused.ts` | `src/membership/webhooks/subscription-paused.ts` |
| subscriptionResumed | `src/webhooks/subscription-resumed.ts` | `src/membership/webhooks/subscription-resumed.ts` |
| productUpdated | `src/webhooks/product-updated.ts` | `src/membership/webhooks/product-updated.ts` |
| findUserByCustomer (internal) | `src/webhooks/find-user-by-customer.ts` | `src/membership/webhooks/find-user-by-customer.ts` |

---

## 5. Components (UI consumed by apps / importMap)

| Component | Source | Target | Exported from bookings-payments |
|-----------|--------|--------|----------------------------------|
| SyncStripe | `src/components/sync/sync-stripe.tsx` | `src/membership/components/sync/sync-stripe.tsx` | Yes (admin importMap) |
| PlanList | `src/components/plans/plan-list.tsx` | `src/membership/components/plans/plan-list.tsx` | Yes (frontend) |
| PlanDetail | `src/components/plans/plan-detail.tsx` | `src/membership/components/plans/plan-detail.tsx` | Yes (frontend) |
| PlanView | `src/components/plans/plan-view.tsx` | `src/membership/components/plans/plan-view.tsx` | If used by PlanList/PlanDetail |
| CheckoutSessionButton | `src/components/checkout-session-button.tsx` | `src/membership/components/checkout-session-button.tsx` | If used by apps |
| Price | `src/components/price.tsx` | `src/membership/components/price.tsx` | If used by PlanList/PlanDetail/PlanView |
| SyncButton | `src/components/sync/sync-button.tsx` | `src/membership/components/sync/sync-button.tsx` | If used by SyncStripe |
| manage-membership, membership-detail, memebership-list, subscription-status | `src/components/ui/*` | `src/membership/components/ui/*` | If used by any exported component or apps |

---

## 6. Lib / Utils / Fields / Hooks / Actions

| Category | Files | Target |
|----------|-------|--------|
| **lib** | `src/lib/sync-stripe-subscriptions.ts` | `src/membership/lib/sync-stripe-subscriptions.ts` |
| **utils** | `src/utils/subscription.ts` | `src/membership/utils/subscription.ts` |
| **fields** | `src/fields/subscription.ts` | `src/membership/fields/subscription.ts` |
| **hooks** | `src/hooks/before-product-change.ts`, `before-subscription-change.ts`, `is-subscribed.ts` | `src/membership/hooks/*` |
| **actions** | `src/actions/plans.ts` | `src/membership/actions/plans.ts` |

Copy all of these under `src/membership/` in the same structure (or flattened as needed), and update internal imports to use the new paths.

---

## 7. Exports from bookings-payments

After transfer, `packages/bookings-payments/src/index.ts` should:

- Export subscription webhooks from **local** `src/membership/webhooks/` (not from `@repo/memberships`).
- Export **SyncStripe**, **PlanList**, **PlanDetail** (and any other UI that apps or importMap use).
- **Remove** re-exports from `@repo/memberships`.
- **Remove** dependency on `@repo/memberships` in `package.json`.

---

## 8. Plugin Wiring in bookings-payments

In `packages/bookings-payments/src/plugin/index.ts`:

- **Remove** `import { membershipsPlugin } from "@repo/memberships"`.
- When `membership?.enabled`:
  - Modify users using the in-tree membership users modifier (from `src/membership/collections/users.ts`).
  - Add **plans** and **subscriptions** from in-tree factories (`src/membership/collections/plans.ts`, `subscriptions.ts`), passing `membership.plansOverrides` and `membership.subscriptionOverrides`.
  - Register the five membership endpoints (plans, subscriptions, create-checkout-session, create-customer-portal, sync-stripe-subscriptions).
  - For each `membership.paymentMethodSlugs` slug: inject `paymentMethods.allowedPlans` (and join field on plans) using the same logic as the current memberships plugin.
- **Do not** call `membershipsPlugin`; all logic runs in-tree.

---

## 9. Consumer Updates (after transfer)

- **kyuzo, darkhorse-strength, bru-grappling**: Import PlanList, PlanDetail, SyncStripe, and subscription webhooks from `@repo/bookings-payments`; point admin importMap at bookings-payments for SyncStripe; remove `@repo/memberships` from deps and transpilePackages.
- **payments-next**: Import PlanList, PlanDetail from `@repo/bookings-payments`; remove `@repo/memberships`.
- **integration-testing**: Use bookingsPaymentsPlugin for membership config; import webhooks from `@repo/bookings-payments`; remove `@repo/memberships`.
- **mindful-yard**: Remove `@repo/memberships` from transpilePackages if still present.

---

## 10. Delete memberships package

- Remove `packages/memberships` (or move to deprecated).
- Run `pnpm install` and fix any remaining references.
