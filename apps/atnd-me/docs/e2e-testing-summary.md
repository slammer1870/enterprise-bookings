# `atnd-me` E2E Testing Summary

This document summarises the current Playwright E2E coverage in `apps/atnd-me/tests/e2e`.

It is focused on what the suite currently verifies:
- the user stories covered
- the concrete scenarios in each spec
- the expected outcomes asserted by the tests

## Coverage Themes

- Public tenant routing and tenant-scoped content
- Booking creation, checkout, and booking management
- Class pass, membership, drop-in, fee, and discount flows
- Pending booking and checkout edge cases
- Stripe Connect onboarding and payment-method gating
- Payload admin access, tenant scoping, and lesson/page admin flows
- Public form submission

## Full List Of User Stories

- As a visitor, I can load the root site and the tenants listing.
- As a visitor, I am routed correctly depending on subdomain validity.
- As a visitor, the same page slug can exist on multiple tenants and resolve per tenant host.
- As a visitor, I only see footer content for the current tenant.
- As a user on a tenant site, I can make a pay-at-door booking and reach confirmation.
- As a user, I can load booking flows that use drop-in, membership, and class pass payment methods.
- As a user with a valid class pass, I can book a lesson using that pass and my remaining credits decrease.
- As a user without a valid class pass, I can see the option to buy a pass when the lesson allows one.
- As a user, trial drop-in pricing only applies to my first eligible booking.
- As a user, multi-quantity drop-in discounts are reflected in both UI and payment intent creation.
- As a user, platform booking fees are disclosed in the booking price breakdown.
- As a user with multiple bookings, I can manage booking quantity from the manage route.
- As a user, booking and manage routes redirect correctly based on how many bookings I already have.
- As a user, capacity guards stop me from increasing beyond remaining lesson capacity.
- As a user, payment methods that do not allow multiple slots keep booking quantity capped at one.
- As a user, payment methods that do allow quantity upgrades send me to checkout for additional slots.
- As a user with only pending bookings, I can still access the booking flow without being redirected to home.
- As a user, abandoned or cancelled checkout state cleans up pending bookings and restores a correct manage view.
- As a past-due membership user, I see upgrade guidance and can launch the upgrade flow.
- As a public user, I can submit a published form block and receive a success state.
- As a tenant admin, payment configuration is gated until Stripe Connect is active.
- As a tenant admin, I can start Stripe Connect onboarding from the admin UI.
- As a tenant admin, I can see when Stripe Connect is already connected.
- As a super admin or tenant admin, I can access the admin panel according to role and host rules.
- As a super admin, tenant-scoped documents lock the tenant selector to the document tenant.
- As a super admin, I can clear tenant filtering on list views and see cross-tenant content again.
- As a super admin or tenant admin, I can open the lessons admin route.
- As a super admin, I can create a lesson in admin and see it on the calendar for the correct date.
- As an admin, the pages block picker only exposes blocks allowed by role and tenant context.

## Spec Coverage Matrix

### `app-smoke.e2e.spec.ts`

**Stories covered**
- Root site availability
- Public tenants listing availability
- Basic pay-at-door booking
- Basic Stripe/drop-in checkout rendering
- Class-pass-only booking page availability
- Manage page accessibility for multiple bookings
- Super admin admin-panel access

**Cases and expected outcomes**
- Root site and `/tenants` load successfully.
- A pay-at-door lesson allows quantity selection, booking submission, and reaches a thank-you confirmation state.
- A Stripe/drop-in-enabled lesson shows payment-method UI and fee breakdown.
- A class-pass-only lesson loads booking UI and shows either a valid booking path or a no-payment-methods state.
- A user with multiple confirmed bookings reaches `/manage` and sees manage UI.
- A super admin can open `/admin` without being stuck on the login page.

### `tenant-routing.e2e.spec.ts`

**Stories covered**
- Root-domain routing
- Valid tenant subdomain routing
- Invalid tenant subdomain handling

**Cases and expected outcomes**
- The root host resolves without tenant context.
- A valid tenant subdomain resolves to the tenant home page with the expected tenant context.
- An invalid subdomain shows a not-found-style response or safely redirects back to a non-tenant root.

### `tenant-scoped-page-slugs.e2e.spec.ts`

**Stories covered**
- Tenant-scoped page resolution for duplicate slugs

**Cases and expected outcomes**
- Two tenants can use the same page slug and each resolves correctly on its own subdomain.

### `footer-tenant-scoping.e2e.spec.ts`

**Stories covered**
- Footer isolation per tenant

**Cases and expected outcomes**
- Tenant 1 footer content does not appear on tenant 2.
- After adding tenant 2 footer content, each tenant still only shows its own footer text.

### `pages-layout-blocks-access.e2e.spec.ts`

**Stories covered**
- Admin block-picker permissions by role and tenant
- Basic page editing and save flow

**Cases and expected outcomes**
- An admin can add a supported layout block to a page and save successfully.
- A super admin without tenant context sees the default blocks plus extra globally available blocks.
- A super admin with tenant context sees the default set for that tenant context.
- A tenant admin with empty `allowedBlocks` sees only default blocks.
- A tenant admin with configured `allowedBlocks` sees the allowed extra blocks.
- Separate tenant-admin contexts stay isolated from each other, while super admin sees the broader set.

### `form-submission.e2e.spec.ts`

**Stories covered**
- Public form submission from published page content

**Cases and expected outcomes**
- Submitting a public form block posts to `/api/form-submissions`, receives a successful response, and shows a thank-you state.

### `admin-panel-access.e2e.spec.ts`

**Stories covered**
- Admin access control by role and tenant host

**Cases and expected outcomes**
- Unauthenticated access to tenant-host `/admin` redirects to tenant-host login.
- A tenant admin can access admin on their own tenant host.
- A tenant admin cannot access admin for another tenant host.
- Super admin and tenant admin can reach allowed admin routes.
- A regular user is denied admin access and lands in login, unauthorized, forbidden, or equivalent blocked states.

### `admin-tenant-selector-required-collection.e2e.spec.ts`

**Stories covered**
- Tenant selector locking for tenant-scoped documents

**Cases and expected outcomes**
- Opening a tenant-scoped subscription document shows the document tenant in the selector.
- The selector cannot be cleared or switched away from that tenant.
- The `payload-tenant` cookie stays aligned with the document tenant.

### `admin-tenant-selector-clear-on-list.e2e.spec.ts`

**Stories covered**
- Clearing tenant filter on admin list views

**Cases and expected outcomes**
- A filtered list initially shows only one tenant's content.
- Clearing tenant context and reloading returns the list to an all-tenants state.
- The all-tenants state persists after another reload.

### `admin-payment-methods-gated-by-connect.e2e.spec.ts`

**Stories covered**
- Payment configuration gating by Stripe Connect status

**Cases and expected outcomes**
- When Stripe Connect is not active, the class-option UI shows a gated payment section with Connect guidance.
- When Stripe Connect is active, the payment section renders for configuration instead of blocking setup.

### `stripe-connect-onboarding.e2e.spec.ts`

**Stories covered**
- Stripe Connect onboarding CTA
- Stripe authorize route wiring
- Connected-state admin UI

**Cases and expected outcomes**
- A disconnected tenant sees the Connect Stripe CTA.
- The CTA points at the authorize endpoint and redirects to Stripe.
- A connected tenant sees connected-state messaging and the connect CTA is hidden.

### `admin-create-lesson.e2e.spec.ts`

**Stories covered**
- Lesson creation from admin and calendar visibility

**Cases and expected outcomes**
- An admin can create a class option and a future lesson, navigate the calendar, and see that lesson on the expected date.

### `lessons-admin-route.e2e.spec.ts`

**Stories covered**
- Lessons admin route access for super admin and tenant admin

**Cases and expected outcomes**
- A super admin can open the lessons list and see the expected page heading and creation affordance.
- A tenant admin can also load the lessons route and see tenant-scoped list content or empty/loading states.

### `booking-with-class-pass.e2e.spec.ts`

**Stories covered**
- Booking with an existing class pass
- Buying-then-using a class pass
- Buy-pass visibility when no valid pass exists

**Cases and expected outcomes**
- A user with a valid pass sees the Class pass tab, confirms the booking, reaches thank-you, and the pass quantity decreases from 5 to 3.
- A user without a pass sees buy-pass UI; after a pass is created to simulate completed purchase, they can return, book with the pass, reach thank-you, and the pass quantity decreases from 5 to 3.
- A user without a valid pass still sees the buy-pass path when the lesson allows that pass type.

### `manage-booking-upgrade-guards.e2e.spec.ts`

**Stories covered**
- Single-slot guardrails for disallowed multi-booking payment methods
- Checkout escalation for allowed quantity upgrades

**Cases and expected outcomes**
- For disallowed variants, the booking page shows copy that only one slot is allowed, there is no usable quantity-increase path, and the manage page keeps quantity at 1 with increase disabled.
- For allowed variants, a user can increase from 1 to 2 on manage, submit the update, reach checkout, see pending-booking messaging, and see the correct tabs for the configured payment methods.

### `two-pending-bookings-access-booking-route.e2e.spec.ts`

**Stories covered**
- Booking-route access when a user has only pending bookings

**Cases and expected outcomes**
- A user with zero confirmed bookings and two pending bookings is not redirected to home when visiting `/bookings/[id]`.
- The user sees booking or manage flow content rather than an error page.
- The user can clear the pending state if needed and complete a fresh booking through to thank-you.

### `trialable-dropin-first-booking-only.e2e.spec.ts`

**Stories covered**
- Trial drop-in pricing eligibility

**Cases and expected outcomes**
- The first eligible lesson shows the trial price.
- After any confirmed booking exists, a later eligible lesson shows the full price and no longer shows the trial price.

### `pending-bookings-cleanup-on-leave.e2e.spec.ts`

**Stories covered**
- Pending-booking cleanup when leaving checkout or manage

**Cases and expected outcomes**
- In a payment-method flow, increasing quantity creates checkout state, leaving the page cleans up pendings, and returning to manage shows only the confirmed quantity with no checkout state.
- In a no-payment-method flow, leaving manage after creating pending state also restores the confirmed-only state.
- The database ends with only the original confirmed booking active.

### `past-due-membership-upgrade.e2e.spec.ts`

**Stories covered**
- Upgrade path from a past-due membership booking flow

**Cases and expected outcomes**
- The manage flow shows complete-payment UI, payment-method context, and plan-mismatch upgrade messaging.
- The Upgrade action is enabled and navigates to the upgrade portal URL.

### `multi-booking-manage.e2e.spec.ts`

**Stories covered**
- Booking/manage route redirection rules
- Increasing and decreasing booking quantity
- Capacity guardrails

**Cases and expected outcomes**
- Visiting the booking page with multiple existing bookings redirects to `/manage`.
- Visiting `/manage` with no bookings redirects back to the booking page or auth as appropriate.
- Visiting booking or manage with one booking settles into a valid book/manage/auth state.
- A user can decrease quantity from 3 to 1 and see UI reflect one remaining booking.
- A user can increase quantity from 1 to 2 in a pay-at-door flow and see UI reflect two bookings.
- When lesson capacity is exhausted, quantity increase is prevented or update submission surfaces a capacity-style error.

### `manage-pending-checkout-edge-case.e2e.spec.ts`

**Stories covered**
- Returning to manage with both confirmed and pending bookings
- Cancelling pending checkout state

**Cases and expected outcomes**
- A user with confirmed and pending bookings sees complete-payment and pending-booking messaging on manage.
- Cancelling from that state returns the UI to quantity management at the confirmed quantity.
- The database keeps exactly the confirmed bookings and removes the pending ones.

### `drop-in-multi-quantity-discount.e2e.spec.ts`

**Stories covered**
- Multi-quantity drop-in discount application

**Cases and expected outcomes**
- Quantity 1 shows the base price.
- Increasing to quantity 2 updates the UI to show the original total struck through and the discounted total.
- The request to create a payment intent uses the discounted price value.

### `cancel-booking-after-decrease.e2e.spec.ts`

**Stories covered**
- Booking cancellation consistency after a prior quantity decrease

**Cases and expected outcomes**
- After reducing a user's bookings from 2 to 1 via API, cancelling the remaining booking succeeds without tRPC error.
- The database ends with zero active bookings.

### `booking-fee-disclosure.e2e.spec.ts`

**Stories covered**
- Booking fee disclosure during checkout

**Cases and expected outcomes**
- With platform drop-in fees configured, the checkout breakdown shows class price, booking fee, total, and payment total with the expected values.

## Notes On Implementation Style

- The suite is Playwright-based and uses worker-scoped fixtures plus direct Payload setup helpers to create isolated tenants, users, lessons, bookings, and payment data.
- Some specs mix browser assertions with API or direct data setup to make edge cases deterministic and keep runtime practical.
- Several booking flows intentionally simulate external payment completion by creating the resulting records directly rather than attempting a live third-party checkout.
- The suite is primarily a business-flow regression suite, so most tests assert route stability, visible UI state, and final booking/payment side effects rather than low-level component behavior.
