# atnd-me Tests

This directory contains integration and E2E tests for the `atnd-me` app.

## Test Structure

### Integration Tests (`int/`)

#### `trpc-bookings.int.spec.ts`
Integration tests for tRPC booking procedures:
- `lessons.getByIdForBooking`: Fetches lesson for booking, handles errors
- `bookings.createBookings`: Creates single and multiple bookings, validates capacity

These tests:
- Use a real Payload instance with test database
- Create test users, lessons, and class options
- Test authentication and authorization
- Clean up test data after each test

### E2E Tests (`e2e/`)

#### `booking-flow.e2e.spec.ts`
End-to-end tests for the booking page flow:
- Redirects to login when accessing booking page without authentication
- Displays booking page after authentication
- Allows selecting quantity and submitting booking
- Displays error when lesson is fully booked
- Validates quantity selection

These tests:
- Use Playwright to interact with the browser
- Test the full user journey from navigation to booking submission
- Handle various edge cases and error scenarios

## Running Tests

```bash
# Run integration tests
pnpm test:int

# Run E2E tests
pnpm test:e2e

# Run all tests
pnpm test
```

## Test Setup

### Integration Tests
- Use Vitest with React testing environment
- Require a running Payload instance
- Create isolated test data for each test suite

### E2E Tests
- Use Playwright for browser automation
- Require the Next.js dev server to be running
- Test the full application stack

## Notes

- Integration tests mock Payload's `auth()` method to simulate authenticated users
- E2E tests may need test data to be seeded before running
- Both test types clean up their test data after execution
