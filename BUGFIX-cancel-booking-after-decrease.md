# Bug Fix: Cancel Booking After Decrease Edge Case

## Issue
When a user had multiple bookings for a lesson, modified the bookings so that only one remained, navigated back to the schedule, and clicked the "Cancel Booking" button, they received a 403 error:

```
Error [TRPCError]: You are not allowed to perform this action.
```

## Root Cause
The issue was in the `bookingUpdateAccess` function in `/packages/bookings/bookings-plugin/src/access/bookings.ts`. 

When the tRPC mutation `setMyBookingForLesson` called `updateSafe` with `overrideAccess: false`, it triggered the access control check. The `bookingUpdateAccess` function tried to look up the booking by ID to verify permissions, but it wasn't using `overrideAccess: true` for these lookups.

In a multi-tenant setup, the `multiTenantPlugin` adds a `tenant` field to the `bookings` collection and applies tenant-scoped read access control. Without `overrideAccess: true`, the booking lookup was subject to tenant filtering, and if the tenant context wasn't properly set or accessible, the booking wouldn't be found, causing the access check to fail.

## Solution
Modified the `bookingUpdateAccess` and `bookingCreateAccess` functions to use `overrideAccess: true` when looking up documents for permission checking purposes. This is a common pattern in Payload CMS access control - you need to override access to check if the user has permission, but the final operation still respects access control.

### Changes Made

1. **`bookingUpdateAccess` function** - Added `overrideAccess: true` to:
   - `findByID` call for looking up the booking (line 78)
   - `find` call for looking up the booking by lesson and user (line 88)
   - `findByID` call for looking up the lesson (line 100)
   - `findByID` call for looking up the user (line 107)

2. **`bookingCreateAccess` function** - Added `overrideAccess: true` to:
   - `findByID` call for looking up the lesson (line 23)

## Files Modified
- `/packages/bookings/bookings-plugin/src/access/bookings.ts`

## Test Coverage
Created a new E2E test to verify the fix:
- `/apps/atnd-me/tests/e2e/cancel-booking-after-decrease.e2e.spec.ts`

The test covers the exact scenario:
1. Create 2 bookings for a user
2. Decrease to 1 booking via the manage page
3. Navigate back to schedule
4. Click the "Cancel Booking" button
5. Verify the cancellation succeeds without a 403 error

## Why This Works
Access control functions need to look up related documents to make permission decisions. These lookups should use `overrideAccess: true` because:

1. The access control function itself is responsible for determining permissions
2. The final operation (e.g., `updateSafe` with `overrideAccess: false`) still enforces access control
3. Without `overrideAccess: true`, the lookups are subject to the same access control being evaluated, creating a circular dependency

This is documented in the Payload CMS security patterns as a critical pattern for access control in multi-tenant applications.

## Related Documentation
- Payload CMS Access Control: https://payloadcms.com/docs/access-control
- Security Critical Patterns: `/apps/atnd-me/.cursor/rules/security-critical.mdc`
