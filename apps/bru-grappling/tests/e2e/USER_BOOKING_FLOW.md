# User Booking Flow E2E Tests

This document describes the end-to-end tests for the complete user booking flow in the bru-grappling application.

## Test Overview

The `user-booking-flow.e2e.spec.ts` file contains comprehensive tests that simulate a real user journey:

### Test 1: Complete User Booking Flow
1. **Visit Homepage** - User lands on the homepage
2. **Click on Lesson** - User clicks on an available lesson to check-in
3. **Redirect to Registration** - Unauthenticated users are redirected to the registration page
4. **Complete Registration** - User fills out and submits the registration form
5. **Redirect to Booking** - After successful registration, user is redirected back to the booking page
6. **Complete Booking** - User completes the booking by selecting payment method and confirming

### Test 2: Existing User Login Flow
1. **Create Test User** - Sets up a test user account
2. **Sign Out** - Logs out the test user
3. **Attempt Booking** - Tries to access a booking page while logged out
4. **Login** - Completes the login form
5. **Access Booking** - Verifies redirect back to booking page after login

## Running the Tests

### Prerequisites

1. Make sure the database is running (via Docker or locally)
2. Ensure all dependencies are installed:
   ```bash
   pnpm install
   ```

### Run All E2E Tests

```bash
# From the bru-grappling directory
pnpm test:e2e
```

### Run Only User Booking Flow Tests

```bash
# From the bru-grappling directory
npx playwright test user-booking-flow
```

### Run Tests in UI Mode (Recommended for Development)

```bash
npx playwright test user-booking-flow --ui
```

This opens the Playwright UI where you can:
- See the test steps in real-time
- Pause and inspect at any point
- View screenshots and traces
- Debug failures easily

### Run Tests in Headed Mode (See Browser)

```bash
npx playwright test user-booking-flow --headed
```

### Run Specific Test

```bash
# Run only the complete booking flow test
npx playwright test user-booking-flow -g "should complete full booking flow"

# Run only the login flow test
npx playwright test user-booking-flow -g "should handle existing user login flow"
```

## Test Configuration

The tests use the configuration from `playwright.config.ts`:

- **Base URL**: `http://localhost:3000`
- **Test Directory**: `./tests/e2e`
- **Browser**: Chromium (Desktop Chrome)
- **Timeout**: 90 seconds per test
- **Screenshots**: Automatically saved to `test-results/screenshots/`

## Test Data

The tests generate unique test users for each run:
- Email: `testuser{timestamp}@example.com`
- Password: `TestPassword123!`
- Name: `Test User`

This ensures tests don't conflict with each other and can be run multiple times.

## Screenshots

The test automatically captures screenshots at key points:

1. `01-homepage.png` - Initial homepage
2. `02-no-lessons-found.png` - If no lessons are found (debugging)
3. `03-after-lesson-click.png` - After clicking a lesson
4. `04-auth-page.png` - Registration/login page
5. `05-register-form.png` - Registration form
6. `06-filled-form.png` - Completed registration form
7. `07-after-registration.png` - After submitting registration
8. `08-booking-page.png` - Booking page
9. `09-after-payment-click.png` - After clicking payment button
10. `10-final-state.png` - Final state after booking

Screenshots are saved to `test-results/screenshots/` directory.

## Debugging

### View Test Report

After running tests, view the HTML report:

```bash
npx playwright show-report
```

### Enable Debug Mode

```bash
DEBUG=pw:api npx playwright test user-booking-flow
```

### Trace Viewer

If a test fails, Playwright automatically captures a trace. View it with:

```bash
npx playwright show-trace test-results/.../trace.zip
```

## Common Issues

### Issue: No lessons found on homepage

**Solution**: Make sure you have lessons created in the database. You can:
1. Run the admin setup tests first to create test data
2. Manually create lessons via the admin panel
3. The test will attempt to navigate to `/bookings/1` as a fallback

### Issue: Test times out during registration

**Solution**: 
1. Check that the auth service is running properly
2. Verify email/password validation rules
3. Increase timeout in the test if needed

### Issue: Redirect doesn't work after registration

**Solution**:
1. Check that the `callbackUrl` parameter is being preserved
2. Verify the auth middleware is correctly handling redirects
3. Check browser console for errors (run in headed mode)

## Test Maintenance

### Updating Selectors

If the UI changes, you may need to update the selectors in the test:

- **Lesson selectors**: Update the `lessonSelectors` array
- **Payment button selectors**: Update the `paymentSelectors` array
- **Form fields**: Update the role-based selectors for form inputs

### Adding New Test Cases

To add new test cases:

1. Add a new `test()` block in the describe block
2. Use the existing helper functions from `utils/auth.ts` and `utils/helpers.ts`
3. Follow the pattern of taking screenshots at key points
4. Add appropriate assertions to verify expected behavior

## Integration with CI/CD

These tests can be integrated into your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Run E2E Tests
  run: |
    pnpm test:e2e
  env:
    CI: true
```

The tests will automatically:
- Run in headless mode
- Retry failed tests (2 retries on CI)
- Generate HTML reports
- Exit with appropriate status codes

## Related Files

- `playwright.config.ts` - Playwright configuration
- `tests/e2e/fixtures.ts` - Test fixtures and helpers
- `tests/e2e/utils/auth.ts` - Authentication helper functions
- `tests/e2e/utils/helpers.ts` - General helper functions
- `tests/e2e/global-setup.ts` - Global test setup
- `tests/e2e/global-teardown.ts` - Global test teardown

