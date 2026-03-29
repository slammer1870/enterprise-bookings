# Booking Components Tests

This directory contains unit tests for the booking-related React components in the `@repo/bookings-next` package.

## Test Files

### `components/quantity-selector.test.tsx`
Tests for the `QuantitySelector` component:
- Renders with correct initial quantity
- Displays singular/plural forms correctly
- Calls `onQuantityChange` when quantity is selected
- Only allows selection up to remaining capacity
- Handles edge cases (0 capacity)

### `components/booking-form.test.tsx`
Tests for the `BookingForm` component:
- Renders booking form with correct information
- Displays singular/plural forms for slots
- Submits booking when form is submitted
- Shows success toast and redirects on successful booking
- Shows error toast on booking failure
- Disables submit button when quantity is invalid
- Shows loading state during submission

### `components/booking-page-client.test.tsx`
Tests for the `BookingPageClient` component:
- Renders all child components (BookingSummary, QuantitySelector, BookingForm)
- Initializes with quantity of 1
- Updates quantity when selector changes
- Passes `onSuccessRedirect` to BookingForm
- Only shows booking form when quantity is valid

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test quantity-selector
```

## Test Setup

Tests use:
- **Vitest** for the test runner
- **@testing-library/react** for React component testing
- **@testing-library/user-event** for user interaction simulation
- **@testing-library/jest-dom** for DOM matchers

The test configuration is in `vitest.config.mts` and uses the shared testing config from `@repo/testing-config`.
