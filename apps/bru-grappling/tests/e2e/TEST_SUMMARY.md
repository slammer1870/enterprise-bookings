# E2E Test Summary - User Booking Flow

## ✅ What Was Created

### 1. Main Test File
**File**: `user-booking-flow.e2e.spec.ts`

Contains two comprehensive tests:

#### Test 1: Complete User Booking Flow
Simulates a new user's complete journey from homepage to booking completion:
- Visits homepage
- Clicks on a lesson
- Gets redirected to registration
- Completes registration form
- Gets redirected back to booking
- Completes the booking

#### Test 2: Existing User Login Flow
Tests the login flow for returning users:
- Creates a test user
- Signs out
- Attempts to access a booking
- Logs in
- Verifies redirect to booking page

### 2. Documentation Files

- **`USER_BOOKING_FLOW.md`** - Comprehensive documentation with:
  - Detailed test descriptions
  - Running instructions
  - Configuration details
  - Debugging tips
  - CI/CD integration guide

- **`QUICK_START_USER_BOOKING.md`** - Quick reference for:
  - Immediate test execution
  - Common commands
  - Troubleshooting tips

- **`TEST_SUMMARY.md`** - This file, overview of everything created

## 🚀 Quick Start

```bash
# Navigate to the app directory
cd /Users/sammcnally/Documents/Programming/new-bookings/apps/bru-grappling

# Run the test (headless)
npx playwright test user-booking-flow

# Run with visible browser
npx playwright test user-booking-flow --headed

# Run in UI mode (recommended for development)
npx playwright test user-booking-flow --ui
```

## 📸 Screenshots

The test automatically captures screenshots at 10+ key points:
- Homepage
- After clicking lesson
- Auth/registration page
- Filled form
- After registration
- Booking page
- After payment
- Final state

All saved to: `test-results/screenshots/`

## 🔧 Test Features

### Smart Selectors
The test uses multiple fallback selectors to handle different UI variations:
- Tries multiple patterns for finding lessons
- Handles both `/complete-booking` and `/auth/sign-in` flows
- Adapts to different payment button variations

### Unique Test Data
Each test run generates unique user credentials:
```javascript
const timestamp = Date.now()
const testEmail = `testuser${timestamp}@example.com`
```

This prevents conflicts between test runs.

### Comprehensive Logging
Console logs at each step help with debugging:
```
Step 1: Visiting homepage...
Step 2: Looking for available lessons...
Found lesson URL: /bookings/1
Step 3: Checking if redirected to auth page...
...
```

### Automatic Fallbacks
If lessons aren't found on homepage, test attempts `/bookings/1` directly.

## 🎯 What Gets Tested

### User Registration
- ✅ Form visibility
- ✅ Field filling (name, email, password, confirm password)
- ✅ Form submission
- ✅ Redirect after registration

### Authentication Flow
- ✅ Redirect to auth when not logged in
- ✅ Login form functionality
- ✅ Callback URL preservation
- ✅ Post-login redirect

### Booking Flow
- ✅ Lesson selection from homepage
- ✅ Booking page access
- ✅ Payment method selection
- ✅ Booking confirmation

## 🛠️ Integration with Existing Tests

The new tests integrate seamlessly with existing test infrastructure:

### Uses Existing Utilities
- `utils/auth.ts` - `signUp()`, `signIn()`, `signOut()` functions
- `utils/helpers.ts` - `waitForPageLoad()`, `clickButton()`, etc.
- `fixtures.ts` - Test fixtures and context

### Follows Existing Patterns
- Same naming convention (`*.e2e.spec.ts`)
- Same configuration (`playwright.config.ts`)
- Same screenshot strategy
- Same timeout handling

### Complements Existing Tests
- `admin-fresh-setup.e2e.spec.ts` - Admin setup
- `admin-lesson-creation.e2e.spec.ts` - Lesson creation
- `admin-page-creation.e2e.spec.ts` - Page creation
- **NEW**: `user-booking-flow.e2e.spec.ts` - User booking flow

## 📊 Test Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Test Execution Flow                      │
└─────────────────────────────────────────────────────────────┘

1. Global Setup (global-setup.ts)
   └─> Creates TestContainer database
   
2. Web Server Starts
   └─> Runs migrations
   └─> Starts dev server on localhost:3000
   
3. Test Execution
   ├─> Test 1: Complete User Booking Flow
   │   ├─> Visit homepage
   │   ├─> Click lesson
   │   ├─> Register new user
   │   ├─> Complete booking
   │   └─> Verify success
   │
   └─> Test 2: Existing User Login Flow
       ├─> Create user
       ├─> Sign out
       ├─> Attempt booking
       ├─> Login
       └─> Verify redirect
       
4. Global Teardown (global-teardown.ts)
   └─> Cleans up TestContainer database
```

## 🐛 Debugging

### View HTML Report
```bash
npx playwright show-report
```

### Enable Debug Logs
```bash
DEBUG=pw:api npx playwright test user-booking-flow
```

### View Trace (on failure)
```bash
npx playwright show-trace test-results/.../trace.zip
```

### Run Single Test
```bash
# Just the booking flow
npx playwright test user-booking-flow -g "should complete full booking flow"

# Just the login flow
npx playwright test user-booking-flow -g "should handle existing user login flow"
```

## 📝 Maintenance Notes

### When UI Changes
Update selectors in the test:
- `lessonSelectors` array - for finding lessons on homepage
- `paymentSelectors` array - for finding payment buttons
- Form field selectors - if form structure changes

### Adding New Test Cases
1. Add new `test()` block in the describe
2. Use existing helper functions
3. Follow screenshot naming pattern
4. Add console logs for debugging

### CI/CD Integration
Tests are CI-ready:
- Configured in `playwright.config.ts`
- Retries on failure (2 retries in CI)
- Headless mode by default
- HTML report generation

## 🎉 Success Criteria

A successful test run will:
1. ✅ Complete registration without errors
2. ✅ Redirect to booking page after auth
3. ✅ Display booking summary
4. ✅ Allow booking completion
5. ✅ Generate 10+ screenshots
6. ✅ Pass all assertions
7. ✅ Complete in < 90 seconds

## 📞 Support

For issues or questions:
1. Check `USER_BOOKING_FLOW.md` for detailed docs
2. Run in `--ui` mode to debug visually
3. Check screenshots in `test-results/screenshots/`
4. Review console logs for step-by-step execution

## 🔗 Related Files

```
tests/e2e/
├── user-booking-flow.e2e.spec.ts    # Main test file
├── USER_BOOKING_FLOW.md             # Detailed documentation
├── QUICK_START_USER_BOOKING.md      # Quick reference
├── TEST_SUMMARY.md                  # This file
├── fixtures.ts                      # Test fixtures
├── global-setup.ts                  # Global setup
├── global-teardown.ts               # Global teardown
└── utils/
    ├── auth.ts                      # Auth helpers
    └── helpers.ts                   # General helpers
```

## ✨ Next Steps

1. **Run the test**: `npx playwright test user-booking-flow --ui`
2. **Check results**: Review screenshots and HTML report
3. **Integrate into CI**: Add to your CI/CD pipeline
4. **Extend tests**: Add more test cases as needed

---

**Created**: December 6, 2025
**Test Framework**: Playwright 1.56.1
**Target App**: bru-grappling (localhost:3000)

