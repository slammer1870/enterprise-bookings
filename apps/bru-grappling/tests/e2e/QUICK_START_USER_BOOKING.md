# Quick Start: User Booking Flow Tests

## Run the Test Now

```bash
# From the bru-grappling directory
cd /Users/sammcnally/Documents/Programming/new-bookings/apps/bru-grappling

# Run the user booking flow test
npx playwright test user-booking-flow --headed
```

## What the Test Does

The test simulates a real user:

1. 🏠 Visits homepage at `localhost:3000`
2. 🎯 Clicks on a lesson to book
3. 🔐 Gets redirected to registration page
4. ✍️ Fills out registration form with:
   - Name: "Test User"
   - Email: `testuser{timestamp}@example.com`
   - Password: "TestPassword123!"
5. ✅ Submits registration
6. 📅 Gets redirected back to booking page
7. 💳 Completes the booking

## Watch It Run

The `--headed` flag opens a browser so you can watch the test execute in real-time.

## View Screenshots

After running, check `test-results/screenshots/` for screenshots at each step.

## Run in UI Mode (Best for Development)

```bash
npx playwright test user-booking-flow --ui
```

This gives you:
- ⏸️ Pause/resume controls
- 🔍 Step-by-step inspection
- 🐛 Easy debugging
- 📸 Screenshot viewer

## Run Both Tests

```bash
# Run complete booking flow + login flow
npx playwright test user-booking-flow
```

## Troubleshooting

### Server not running?
Make sure your dev server is running on `localhost:3000`:
```bash
pnpm dev
```

### No lessons found?
The test will try `/bookings/1` as a fallback. Create lessons via admin panel if needed.

### Test failing?
1. Run in headed mode to see what's happening: `--headed`
2. Run in UI mode to debug step-by-step: `--ui`
3. Check screenshots in `test-results/screenshots/`

## More Info

See `USER_BOOKING_FLOW.md` for detailed documentation.

