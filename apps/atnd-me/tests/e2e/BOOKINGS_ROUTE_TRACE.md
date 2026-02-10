# Bookings route trace and failure hypotheses

When e2e tests hit `http://{tenantSlug}.localhost:3000/bookings/{lessonId}` and see **"Something went wrong"**, that text comes from the **root error boundary** (`app/global-error.tsx`). So an unhandled exception is thrown somewhere in the bookings flow. Below is the path and likely failure points.

## Request flow

1. **Route**  
   `app/(frontend)/bookings/[id]/page.tsx` → `createBookingPage(id, bookingPageConfig)` (from `@repo/bookings-next`).

2. **createBookingPage** (RSC, `packages/bookings/bookings-next/.../booking-page.tsx`)
   - Parse `id` → redirect to `errorRedirectPath` if invalid.
   - **getSession()** – if no user → redirect to `authRedirectPath`.
   - **getRequestHost()** – `nextHeaders().get('host')` (e.g. `test-tenant-1.localhost:3000`).
   - **createCaller({ host })** – builds tRPC context with `hostOverride: host` so tenant can be resolved from the same request.
   - **caller.lessons.getByIdForBooking({ id })** – can throw (NOT_FOUND, BAD_REQUEST, or any other error).
   - **postValidation(lesson, user, caller)** – atnd-me calls **caller.bookings.getUserBookingsForLesson({ lessonId })**. If this throws, the error is not treated as NOT_FOUND/BAD_REQUEST, so it is rethrown and the user sees "Something went wrong".
   - Render `<BookingPageClientSmart lesson={lesson} ... />`. If serializing `lesson` or rendering throws, same outcome.

3. **getByIdForBooking** (`packages/trpc/src/routers/lessons.ts`)
   - Resolve tenant: cookie `tenant-slug` or from `ctx.hostOverride` / Host (subdomain).
   - Resolve tenant ID from slug (tenants collection).
   - **findByIdSafe(payload, "lessons", id, { depth: 5, overrideAccess: true })** – can throw if DB or Payload fails.
   - If no tenant from headers, derive tenant from lesson/classOption.
   - If tenant present: verify lesson belongs to tenant (else NOT_FOUND).
   - If tenant present: **findByIdSafe(payload, "class-options", coId, { depth: 3, overrideAccess: true })** to populate `classOption.paymentMethods` (allowedDropIn, allowedPlans). Any throw here (e.g. missing DB column, Payload bug) propagates.
   - Booking status checks (closed / already booked / waitlist) → BAD_REQUEST or continue.
   - Return lesson (with classOption replaced by plain object for RSC).

4. **getUserBookingsForLesson** (`packages/trpc/src/routers/bookings.ts`)
   - Same tenant resolution (cookie / host).
   - **findSafe(payload, "bookings", { where: { lesson, user, status }, depth: 2, overrideAccess })** – can throw.
   - Filter results by tenant (booking or lesson.tenant). No throw in filter, but if `findSafe` or collection access fails, error propagates.

5. **Client**
   - `BookingPageClientSmart` uses `lesson.classOption?.paymentMethods?.allowedDropIn` to show payment UI.
   - If `allowedDropIn` is only an ID, `DropInView` fetches `/api/drop-ins/${id}`. **atnd-me has no `/api/drop-ins/[id]` route** – fetch 404s, so the UI shows "Drop-in payment option is not available" (no global error). With getByIdForBooking populating classOption at depth 3, `allowedDropIn` is often a full object, so the client may not need that fetch.

---

## Hypotheses for "Something went wrong"

1. **postValidation / getUserBookingsForLesson throws**
   - If `findSafe` for bookings throws (DB, Payload, or missing collection), or any other error in that procedure, createBookingPage catches it and only redirects on NOT_FOUND/BAD_REQUEST, then rethrows. Result: global error.
   - **Check:** Server logs when the e2e fails; add a try/catch in postValidation and log (or return redirect) instead of letting it throw.

2. **getByIdForBooking – class-options fetch**
   - When tenant is set, we do `findByIdSafe(payload, "class-options", coId, { depth: 3 })`. If Payload or the DB throws (e.g. schema/column mismatch, like the dropped `payment_methods_allowed_class_passes` column still being referenced somewhere), that error propagates.
   - **Check:** Confirm migration `20260210_drop_payment_methods_allowed_class_passes` has been run and that no Payload field still references that column.

3. **getByIdForBooking – lesson fetch or bookingStatus**
   - First call is `findByIdSafe(payload, "lessons", id, { depth: 5 })`. If the lessons collection has hooks (e.g. bookingStatus) that run extra queries or touch a bad schema, they could throw.
   - **Check:** Whether any lesson hook or virtual depends on a dropped or invalid field.

4. **Host/tenant missing on first request**
   - If `getRequestHost()` or headers don’t provide the host (e.g. in some middleware/edge context), `tenantSlug` could be null. We then derive tenant from the lesson; if that fails or is inconsistent, we might still hit a later failure (e.g. in class-option fetch or bookings fetch).
   - **Check:** Log `host` and `tenantSlug` at the start of getByIdForBooking (already present); confirm in failing e2e that host is `{tenantSlug}.localhost:3000`.

5. **RSC serialization**
   - Passing `lesson` (with nested classOption) to the client could in theory hit a serialization error (e.g. non-plain values, circular refs). We use `JSON.parse(JSON.stringify(populated))` for classOption to avoid that; if the main lesson object has other non-serializable fields, that could still throw.
   - **Check:** Inspect the exact error and stack in the global error / Sentry.

6. **Pay-at-door test still touches allowedClassPasses**
   - The pay-at-door smoke test does `payload.update(..., { paymentMethods: { allowedClassPasses: [] } })`. If the schema or any hook still references the dropped column or rels in a way that breaks, that update (or a later read of that class option) could throw. Other tests were updated to only set `allowedDropIn` to avoid this.
   - **Fix:** Stop setting `allowedClassPasses` in the pay-at-door test (same as Stripe test).

---

## Recommended next steps

- Run the failing e2e with **server logs visible** and capture the first exception and stack.
- **Remove `allowedClassPasses` from the pay-at-door test** so it matches the Stripe test and doesn’t touch the dropped column path.
- Optionally **wrap postValidation in try/catch**: on error, log and redirect to `errorRedirectPath` (or a dedicated error page) instead of rethrowing, so the app degrades gracefully and you can still inspect logs.
