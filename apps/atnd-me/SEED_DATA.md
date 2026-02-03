# Seed Data Documentation

This document describes the test data created by the seed function for manual testing of all app functionality.

## Running the Seed

> **⚠️ SECURITY NOTE**: The seed endpoint is **disabled in production** for security reasons. It can only be used in development or staging environments.

### Option 1: Via Admin UI
1. Log in to the admin panel at `/admin`
2. Navigate to the dashboard
3. Click the "Seed Database" button (if available)
   - Note: This button should be hidden in production

### Option 2: Via API Endpoint
```bash
# Make a POST request to /api/seed
# Requires:
# - Authentication as an admin user
# - NODE_ENV must NOT be 'production'
# - Optional: SEED_SECRET header if configured

curl -X POST http://localhost:3000/api/seed \
  -H "Cookie: payload-token=YOUR_TOKEN" \
  -H "x-seed-secret: YOUR_SECRET"  # Only if SEED_SECRET env var is set
```

### Option 3: Via Standalone Script
```bash
pnpm seed
```

**Note**: The script will:
- Block execution in production
- Show a 3-second warning before proceeding
- Require an admin user to exist

## Test Tenants

The seed creates 3 test tenants (dummy business names) for multi-tenant and payment-method testing:

| Name | Slug | Description |
|------|------|-------------|
| Flow Yoga & Fitness | `flow-yoga-fitness` | Main studio with Stripe Connect; full payment variety (Stripe, class pass, drop-in) |
| Pilates & Stretch Co. | `pilates-stretch-co` | No Stripe; class pass and pay-at-door only (isolation testing) |
| Croí Lán Sauna | `croi-lan-sauna` | Sauna studio with Stripe Connect; 50 min / 30 min sessions |

## Test Users

The seed creates 5 test users:

| Email | Password | Role | Purpose |
|-------|----------|------|---------|
| `admin@test.com` | `password` | admin | Admin access for testing admin features (can access all tenants) |
| `tenant-admin@test.com` | `password` | tenant-admin | Tenant admin for Flow Yoga & Fitness (can only manage that tenant's data) |
| `user1@test.com` | `password` | user | Primary test user with multiple bookings |
| `user2@test.com` | `password` | user | Secondary test user |
| `user3@test.com` | `password` | user | Tertiary test user for waitlist testing |

## Instructors

**For Flow Yoga & Fitness:**
- **John Instructor** (`john@instructor.com`) – Active
- **Jane Instructor** (`jane@instructor.com`) – Active

**For Pilates & Stretch Co.:**
- **Maya Chen** (`tenant2@instructor.com`) – Active

**For Croí Lán Sauna:**
- **Croí Lán Sauna Instructor** (`croi-lan-sauna@instructor.com`) – Active

## Class Options

Names explicitly state payment methods for manual testers.

**Flow Yoga & Fitness (Stripe Connect):**
1. **Yoga — Stripe + Class Pass** – 10 places. Pay by card or use Fitness Only / All Access pass.
2. **Fitness — Stripe only** – 15 places. Card payment only; no class passes.
3. **Small Group — Class Pass only** – 5 places. Fitness Only or All Access pass only; no drop-in payment.
4. **Drop-in — No payments (pay at door)** – 8 places. Pay at the door; no Stripe, no class pass.

**Pilates & Stretch Co. (no Stripe):**
1. **Pilates — Class Pass only** – 10 places. All Access pass only.
2. **Stretch — No payments (pay at door)** – 8 places. Pay at the door only.

**Croí Lán Sauna (Stripe Connect):**
1. **50 min session — Stripe + Class Pass** – 12 places. Card or Sauna Only / All Access pass.
2. **30 min session — Class Pass only** – 8 places. Sauna Only or All Access pass only.

## Lessons

The seed creates 7 lessons (6 for Flow Yoga & Fitness, 1 for Pilates & Stretch Co.):

### 1. Past Lesson (Flow Yoga & Fitness)
- **Date**: 2 days ago
- **Time**: 10:00 - 11:00
- **Class**: Yoga — Stripe + Class Pass
- **Location**: Studio A
- **Instructor**: John Instructor
- **Status**: Completed (past date)
- **Bookings**: 1 confirmed (user1)

**Test Scenario**: View booking history

### 2. Active Lesson (Flow Yoga & Fitness)
- **Date**: Tomorrow
- **Time**: 14:00 - 15:00
- **Class**: Yoga — Stripe + Class Pass
- **Location**: Studio A
- **Instructor**: John Instructor
- **Status**: Active (available for booking)
- **Bookings**: 1 (user1), 2 (user2)

**Test Scenario**: Book additional slots, test Stripe + class pass flow

### 3. Partially Booked Lesson (Flow Yoga & Fitness)
- **Date**: 2 days from now
- **Time**: 16:00 - 17:00
- **Class**: Fitness — Stripe only
- **Location**: Studio B
- **Instructor**: Jane Instructor
- **Status**: Active (3/15 places booked)
- **Bookings**: 3 confirmed (user1, user2, user3)

**Test Scenario**: Book remaining slots, test Stripe-only payment

### 4. Fully Booked Lesson (Flow Yoga & Fitness)
- **Date**: 3 days from now
- **Time**: 10:00 - 11:00
- **Class**: Small Group — Class Pass only (5 places)
- **Location**: Studio C
- **Instructor**: John Instructor
- **Status**: Fully booked (5/5)
- **Bookings**: 5 confirmed; 1 waiting (user3)

**Test Scenario**: Fully booked state, waitlist, class-pass-only flow

### 5. Upcoming Lesson (Flow Yoga & Fitness)
- **Date**: 5 days from now
- **Time**: 18:00 - 19:00
- **Class**: Yoga — Stripe + Class Pass
- **Location**: Studio A
- **Instructor**: Jane Instructor
- **Status**: Active
- **Bookings**: 1 pending (user1), 1 cancelled (user2)

**Test Scenario**: Payment flow, cancellation handling

### 6. Manage Bookings Lesson (Flow Yoga & Fitness)
- **Date**: 4 days from now
- **Time**: 12:00 - 13:00
- **Class**: Fitness — Stripe only
- **Location**: Studio B
- **Instructor**: John Instructor
- **Status**: Active
- **Bookings**: 3 confirmed (all user1)

**Test Scenario**: `/bookings/[id]/manage` — increase/decrease quantity, cancel individual bookings

### 7. Pilates & Stretch Co. Lesson (isolation testing)
- **Date**: Tomorrow
- **Time**: 10:00 - 11:00
- **Class**: Pilates — Class Pass only
- **Location**: Main Studio
- **Instructor**: Maya Chen
- **Status**: Active
- **Bookings**: None

**Test Scenario**: Tenant isolation; class pass only (no Stripe)

## Bookings

The seed creates bookings in various states (all scoped to Flow Yoga & Fitness):

### Confirmed Bookings
- Multiple confirmed bookings across different lessons
- Used for testing:
  - Viewing bookings
  - Managing bookings
  - Cancelling bookings

### Pending Booking
- 1 pending booking (user1, upcoming lesson)
- Used for testing:
  - Payment flow
  - Booking confirmation after payment

### Cancelled Booking
- 1 cancelled booking (user2, upcoming lesson)
- Used for testing:
  - Viewing cancelled bookings
  - Booking history

### Waiting Booking
- 1 waiting booking (user3, fully booked lesson)
- Used for testing:
  - Waitlist functionality
  - Waitlist notifications

## Test Scenarios

### Booking Flow
1. **New Booking**: Navigate to `/bookings/[activeLessonId]` and book a slot
2. **Multiple Slots**: Book multiple slots for the same lesson
3. **Fully Booked**: Try to book a fully booked lesson (`/bookings/[fullyBookedLessonId]`)
4. **Capacity Limit**: Try to book more slots than available

### Managing Bookings
1. **View Bookings**: Navigate to `/bookings/[manageBookingsLessonId]/manage`
2. **Increase Quantity**: Add more bookings to existing lesson
3. **Decrease Quantity**: Reduce number of bookings
4. **Cancel Individual**: Cancel a specific booking from the list

### Payment Flow (Future)
1. **Pending Booking**: View pending booking that requires payment
2. **Payment Success**: Complete payment and confirm booking

### Admin Features
1. **View All Bookings**: Access admin panel to view all bookings (admin can see all tenants)
2. **Manage Lessons**: Edit lesson details, capacity, etc.
3. **Manage Class Options**: Edit class option details

### Multi-Tenant Features
1. **Tenant Isolation**: Verify Pilates & Stretch Co. data is separate from Flow Yoga & Fitness
2. **Tenant-Admin Access**: Login as `tenant-admin@test.com` (Flow Yoga & Fitness)
   - Should only see/manage Flow Yoga & Fitness data
   - Should not see Pilates & Stretch Co. or Croí Lán Sauna
3. **Cross-Tenant Booking**: Test booking from different tenants (if enabled)
4. **Tenant-Scoped Pages**: Verify pages, navbar, and footer are scoped per tenant

## Notes

- All test users have the password: `password`
- Dates are relative to when the seed is run (e.g. "tomorrow" = day after seeding)
- The seed clears existing booking data before creating new data
- The seed can be run multiple times safely (it clears data first)
- **Multi-Tenant**: Lessons, class-options, instructors, bookings, pages, navbar, footer are scoped to tenants
- **Tenant Context**: Use the correct tenant (subdomain or context) when testing
- **Tenant-Admin**: Assigned to Flow Yoga & Fitness only
- **Class option names**: Include payment methods (Stripe, Class Pass, pay at door) so manual testers know what they're testing

## Troubleshooting

If the seed fails:
1. Ensure you have an admin user in the database
2. Check that the database connection is working
3. Verify that all required collections exist
4. Check the console logs for specific error messages
5. **If in production**: The seed is intentionally disabled - use development/staging environment

## Security

For detailed security information, see [SEED_SECURITY.md](./SEED_SECURITY.md).

**Key Security Features**:
- ✅ Disabled in production (`NODE_ENV=production`)
- ✅ Requires admin authentication
- ✅ Optional secret token protection
- ✅ Comprehensive logging
- ✅ Standalone script protection
