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

## Test Users

The seed creates 4 test users:

| Email | Password | Role | Purpose |
|-------|----------|------|---------|
| `admin@test.com` | `password` | admin | Admin access for testing admin features |
| `user1@test.com` | `password` | user | Primary test user with multiple bookings |
| `user2@test.com` | `password` | user | Secondary test user |
| `user3@test.com` | `password` | user | Tertiary test user for waitlist testing |

## Instructors

- **John Instructor** (`john@instructor.com`) - Active
- **Jane Instructor** (`jane@instructor.com`) - Active

## Class Options

1. **Yoga Class** - 10 places
   - Description: "A relaxing yoga class for all levels"

2. **Fitness Class** - 15 places
   - Description: "High-intensity fitness training"

3. **Small Group Class** - 5 places
   - Description: "Intimate small group session"

## Lessons

The seed creates 6 lessons with various states:

### 1. Past Lesson
- **Date**: 2 days ago
- **Time**: 10:00 - 11:00
- **Class**: Yoga Class
- **Location**: Studio A
- **Instructor**: John Instructor
- **Status**: Completed (past date)
- **Bookings**: 1 confirmed booking (user1)

**Test Scenario**: View booking history

### 2. Active Lesson
- **Date**: Tomorrow
- **Time**: 14:00 - 15:00
- **Class**: Yoga Class
- **Location**: Studio A
- **Instructor**: John Instructor
- **Status**: Active (available for booking)
- **Bookings**: 
  - 1 booking (user1)
  - 2 bookings (user2)

**Test Scenario**: Book additional slots, view partially booked lesson

### 3. Partially Booked Lesson
- **Date**: 2 days from now
- **Time**: 16:00 - 17:00
- **Class**: Fitness Class
- **Location**: Studio B
- **Instructor**: Jane Instructor
- **Status**: Active (3/15 places booked)
- **Bookings**: 3 confirmed bookings (user1, user2, user3)

**Test Scenario**: Book remaining slots, test capacity limits

### 4. Fully Booked Lesson
- **Date**: 3 days from now
- **Time**: 10:00 - 11:00
- **Class**: Small Group Class (5 places)
- **Location**: Studio C
- **Instructor**: John Instructor
- **Status**: Fully booked (5/5 places)
- **Bookings**: 5 confirmed bookings
- **Waitlist**: 1 waiting booking (user3)

**Test Scenario**: 
- Test fully booked state
- Test waitlist functionality
- Test error handling when trying to book

### 5. Upcoming Lesson
- **Date**: 5 days from now
- **Time**: 18:00 - 19:00
- **Class**: Yoga Class
- **Location**: Studio A
- **Instructor**: Jane Instructor
- **Status**: Active (available for booking)
- **Bookings**: 
  - 1 pending booking (user1) - for payment flow testing
  - 1 cancelled booking (user2) - for cancellation testing

**Test Scenario**: 
- Book new lesson
- Test payment flow (pending booking)
- View cancelled bookings

### 6. Manage Bookings Lesson
- **Date**: 4 days from now
- **Time**: 12:00 - 13:00
- **Class**: Fitness Class
- **Location**: Studio B
- **Instructor**: John Instructor
- **Status**: Active
- **Bookings**: 3 confirmed bookings (all user1)

**Test Scenario**: 
- Access manage bookings page: `/bookings/[id]/manage`
- Test increasing/decreasing quantity
- Test cancelling individual bookings

## Bookings

The seed creates bookings in various states:

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
1. **View All Bookings**: Access admin panel to view all bookings
2. **Manage Lessons**: Edit lesson details, capacity, etc.
3. **Manage Class Options**: Edit class option details

## Notes

- All test users have the password: `password`
- Dates are relative to when the seed is run (e.g., "tomorrow" means the day after seeding)
- The seed clears existing booking data before creating new data
- The seed can be run multiple times safely (it clears data first)

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
