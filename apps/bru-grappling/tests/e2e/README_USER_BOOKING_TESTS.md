# User Booking Flow E2E Tests - Complete Guide

## 🎯 Overview

This test suite simulates a complete user journey through the bru-grappling booking system, from landing on the homepage to completing a booking. It's designed to catch issues in the critical user flow before they reach production.

## 🚀 Quick Start (TL;DR)

```bash
# From the bru-grappling directory
cd /Users/sammcnally/Documents/Programming/new-bookings/apps/bru-grappling

# Option 1: Use the helper script (easiest)
./run-booking-test.sh

# Option 2: Run directly with Playwright
npx playwright test user-booking-flow --ui
```

## 📋 Prerequisites

1. **Server Running**: Make sure your dev server is running on `localhost:3000`
   ```bash
   pnpm dev
   ```

2. **Dependencies Installed**: Ensure all packages are installed
   ```bash
   pnpm install
   ```

3. **Playwright Browsers**: Install Playwright browsers if not already done
   ```bash
   npx playwright install
   ```

## 🧪 Test Scenarios

### Scenario 1: New User Booking Flow
**File**: `user-booking-flow.e2e.spec.ts` (Test 1)

**Steps**:
1. User visits homepage (`/`)
2. User clicks on an available lesson/class
3. System redirects to registration page (user not authenticated)
4. User fills registration form:
   - Name: "Test User"
   - Email: `testuser{timestamp}@example.com`
   - Password: "TestPassword123!"
5. User submits registration
6. System redirects back to booking page
7. User completes booking (selects payment method)
8. System confirms booking

**Duration**: ~30-60 seconds

### Scenario 2: Returning User Login Flow
**File**: `user-booking-flow.e2e.spec.ts` (Test 2)

**Steps**:
1. System creates a test user account
2. User signs out
3. User attempts to access a booking page
4. System redirects to login page
5. User logs in with existing credentials
6. System redirects back to booking page

**Duration**: ~20-40 seconds

## 🎮 Running the Tests

### Method 1: Interactive Script (Recommended)

```bash
./run-booking-test.sh
```

This script:
- ✅ Checks if server is running
- 🎯 Offers 4 run modes (headless, headed, UI, debug)
- 📊 Shows results summary
- 🔗 Provides quick links to reports

### Method 2: Direct Playwright Commands

```bash
# Headless mode (CI-style)
npx playwright test user-booking-flow

# Headed mode (see the browser)
npx playwright test user-booking-flow --headed

# UI mode (best for development)
npx playwright test user-booking-flow --ui

# Debug mode
DEBUG=pw:api npx playwright test user-booking-flow --headed

# Run specific test
npx playwright test user-booking-flow -g "should complete full booking flow"
```

### Method 3: NPM Scripts

```bash
# Run all e2e tests (including this one)
pnpm test:e2e

# Run all tests (integration + e2e)
pnpm test
```

## 📸 Screenshots & Artifacts

### Automatic Screenshots
The test captures screenshots at every major step:

| Screenshot | Description |
|------------|-------------|
| `01-homepage.png` | Initial homepage load |
| `02-no-lessons-found.png` | Debug: if no lessons found |
| `03-after-lesson-click.png` | After clicking lesson link |
| `04-auth-page.png` | Registration/login page |
| `05-register-form.png` | Registration form visible |
| `06-filled-form.png` | Form filled with test data |
| `07-after-registration.png` | After form submission |
| `08-booking-page.png` | Booking page loaded |
| `09-after-payment-click.png` | After payment button click |
| `10-final-state.png` | Final state after booking |

**Location**: `test-results/screenshots/`

### Test Reports

```bash
# View HTML report (after test run)
npx playwright show-report

# View trace (on failure)
npx playwright show-trace test-results/.../trace.zip
```

## 🔧 Configuration

### Playwright Config
**File**: `playwright.config.ts`

Key settings:
- **Base URL**: `http://localhost:3000`
- **Timeout**: 90 seconds per test
- **Retries**: 2 (on CI), 0 (locally)
- **Browser**: Chromium (Desktop Chrome)
- **Workers**: 1 (on CI), unlimited (locally)

### Test Environment
**File**: `test.env`

Environment variables for testing (loaded automatically).

## 🐛 Debugging & Troubleshooting

### Common Issues

#### Issue 1: "No lessons found on homepage"
**Symptoms**: Test fails at step 2, screenshot shows empty homepage

**Solutions**:
1. Create lessons via admin panel
2. Run admin setup tests first: `npx playwright test admin-lesson-creation`
3. Check database has lesson data
4. Test falls back to `/bookings/1` automatically

#### Issue 2: "Registration form not found"
**Symptoms**: Test fails at step 4, can't find form fields

**Solutions**:
1. Check auth service is running
2. Verify registration route is accessible: `curl http://localhost:3000/auth/sign-up`
3. Run in headed mode to see actual page: `--headed`
4. Check for JavaScript errors in browser console

#### Issue 3: "Redirect not working after registration"
**Symptoms**: Test completes registration but doesn't redirect

**Solutions**:
1. Check callback URL is preserved in auth flow
2. Verify auth middleware configuration
3. Check for errors in server logs
4. Ensure session is created correctly

#### Issue 4: "Payment button not found"
**Symptoms**: Test reaches booking page but can't complete

**Solutions**:
1. Check payment service is configured
2. Verify booking status allows payment
3. Update `paymentSelectors` array in test if UI changed
4. Check lesson has available spots

### Debugging Techniques

#### 1. Visual Debugging (Headed Mode)
```bash
npx playwright test user-booking-flow --headed --slowmo=1000
```
Slows down actions by 1 second each.

#### 2. Interactive Debugging (UI Mode)
```bash
npx playwright test user-booking-flow --ui
```
Pause, step through, inspect elements.

#### 3. Debug Logs
```bash
DEBUG=pw:api npx playwright test user-booking-flow
```
Shows detailed Playwright API calls.

#### 4. Pause on Failure
Add to test:
```typescript
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== 'passed') {
    await page.pause()
  }
})
```

#### 5. Console Logs
The test includes extensive console logging:
```
Step 1: Visiting homepage...
Step 2: Looking for available lessons...
Found lesson URL: /bookings/1
...
```

Check terminal output for step-by-step progress.

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Run E2E Tests
        run: pnpm test:e2e
        env:
          CI: true
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

### GitLab CI Example

```yaml
e2e-tests:
  stage: test
  image: mcr.microsoft.com/playwright:v1.56.1-focal
  script:
    - pnpm install
    - pnpm test:e2e
  artifacts:
    when: always
    paths:
      - playwright-report/
      - test-results/
```

## 📊 Test Metrics

### Performance Benchmarks
- **New User Flow**: 30-60 seconds
- **Login Flow**: 20-40 seconds
- **Total Suite**: ~1-2 minutes

### Coverage
The tests cover:
- ✅ Homepage rendering
- ✅ Lesson listing/selection
- ✅ Authentication redirects
- ✅ Registration form validation
- ✅ User creation
- ✅ Session management
- ✅ Booking page access
- ✅ Payment flow initiation
- ✅ Login functionality
- ✅ Callback URL preservation

## 🛠️ Maintenance

### Updating Selectors

If the UI changes, update these arrays in the test:

**Lesson Selectors** (line ~40):
```typescript
const lessonSelectors = [
  'a[href*="/bookings/"]',
  'button:has-text("Book")',
  // Add new selectors here
]
```

**Payment Selectors** (line ~200):
```typescript
const paymentSelectors = [
  'button:has-text("Pay Now")',
  'button:has-text("Complete Booking")',
  // Add new selectors here
]
```

### Adding New Test Cases

```typescript
test('should handle special scenario', async ({ page }) => {
  // 1. Setup
  await page.goto('/')
  
  // 2. Action
  await page.click('button')
  
  // 3. Assert
  await expect(page).toHaveURL(/expected/)
  
  // 4. Screenshot
  await page.screenshot({ path: 'test-results/screenshots/scenario.png' })
})
```

### Test Data Management

**Current Approach**: Generate unique users per test
```typescript
const timestamp = Date.now()
const testEmail = `testuser${timestamp}@example.com`
```

**Alternative**: Use test fixtures
```typescript
// fixtures.ts
export const TEST_USERS = {
  newUser: () => ({
    email: `user${Date.now()}@test.com`,
    password: 'Test123!',
    name: 'Test User'
  })
}
```

## 📚 Related Documentation

- **Quick Start**: `QUICK_START_USER_BOOKING.md`
- **Detailed Guide**: `USER_BOOKING_FLOW.md`
- **Summary**: `TEST_SUMMARY.md`
- **Playwright Docs**: https://playwright.dev
- **Test Utils**: `utils/auth.ts`, `utils/helpers.ts`

## 🤝 Contributing

### Adding New Tests
1. Create test file: `*.e2e.spec.ts`
2. Import utilities: `import { test, expect } from '@playwright/test'`
3. Use helpers: `signUp()`, `signIn()`, `waitForPageLoad()`
4. Add screenshots at key points
5. Document in README

### Reporting Issues
Include:
- Test name
- Error message
- Screenshots from `test-results/`
- Console output
- Steps to reproduce

## 📞 Support & Resources

### Quick Commands Reference
```bash
# Run tests
./run-booking-test.sh                    # Interactive
npx playwright test user-booking-flow    # Direct

# View results
npx playwright show-report               # HTML report
ls test-results/screenshots/             # Screenshots

# Debug
npx playwright test --ui                 # UI mode
npx playwright test --headed             # See browser
DEBUG=pw:api npx playwright test         # Debug logs

# Specific test
npx playwright test -g "booking flow"    # Match pattern
```

### File Structure
```
tests/e2e/
├── user-booking-flow.e2e.spec.ts       # Main test file ⭐
├── README_USER_BOOKING_TESTS.md        # This file
├── USER_BOOKING_FLOW.md                # Detailed docs
├── QUICK_START_USER_BOOKING.md         # Quick reference
├── TEST_SUMMARY.md                     # Overview
├── fixtures.ts                         # Test fixtures
├── global-setup.ts                     # Setup
├── global-teardown.ts                  # Teardown
└── utils/
    ├── auth.ts                         # Auth helpers
    └── helpers.ts                      # General helpers
```

### Getting Help
1. Check this README
2. Review screenshots in `test-results/`
3. Run in UI mode: `--ui`
4. Check Playwright docs: https://playwright.dev
5. Review existing tests for patterns

## ✨ Next Steps

1. **Run the test**: `./run-booking-test.sh`
2. **Review results**: Check screenshots and report
3. **Integrate into CI**: Add to your pipeline
4. **Extend coverage**: Add more test scenarios
5. **Monitor**: Track test results over time

---

**Created**: December 6, 2025  
**Framework**: Playwright 1.56.1  
**App**: bru-grappling  
**Server**: http://localhost:3000  
**Author**: AI Assistant  

Happy Testing! 🎭✨

