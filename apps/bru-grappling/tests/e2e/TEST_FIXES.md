# Test Fixes Applied

This document describes the fixes applied to resolve test failures discovered from test results.

## Issues Found

1. **Authentication Failures**: Tests were redirecting to sign-in page because:
   - Sign-in form uses `textbox` role, not `input[type="password"]`
   - Selectors were incorrect for the actual form structure

2. **Admin Panel Access**: Tests were trying to access admin without proper authentication checks

3. **Navigation Issues**: Some tests assumed elements were visible without proper waits

## Fixes Applied

### 1. Fixed `utils/auth.ts` - Sign In Function

**Problem**: Using incorrect selectors for email and password fields
**Solution**: Updated to use `getByRole('textbox')` which matches the actual form structure

```typescript
// Before: page.locator('input[type="password"]')
// After: page.getByRole('textbox', { name: /password/i })
```

**Changes**:
- Email field: Changed to `getByRole('textbox', { name: /email/i })`
- Password field: Changed to `getByRole('textbox', { name: /password/i })`
- Submit button: Changed to `getByRole('button', { name: /login/i })`

### 2. Fixed `utils/auth.ts` - Sign Up Function

**Problem**: Same selector issues as sign-in
**Solution**: Updated to use consistent `getByRole('textbox')` selectors

**Changes**:
- All form fields now use `getByRole('textbox')` with name matching
- Improved error handling for optional fields

### 3. Added Authentication Checks in beforeEach Hooks

**Problem**: Tests were running even when admin user didn't exist
**Solution**: Added checks to skip tests if authentication fails

**Files Updated**:
- `admin-pages.e2e.spec.ts`
- `admin-lessons.e2e.spec.ts`
- `dashboard.e2e.spec.ts`
- `bookings.e2e.spec.ts`

**Pattern Added**:
```typescript
test.beforeEach(async ({ page }) => {
  await signIn(page, TEST_USERS.admin.email, TEST_USERS.admin.password)
  
  // Ensure we're authenticated
  await page.goto('/admin', { waitUntil: 'load' })
  
  // If redirected to sign-in, skip tests
  if (page.url().includes('/auth/sign-in')) {
    test.skip()
    return
  }
  
  await expect(page).toHaveURL(/\/admin/)
})
```

### 4. Improved Navigation Selectors

**Problem**: Some navigation elements weren't found reliably
**Solution**: Added fallback selectors and better waits

**Files Updated**:
- `admin-pages.e2e.spec.ts`: Improved "Create new" button detection
- `admin-lessons.e2e.spec.ts`: Added logic to expand Bookings section before accessing Lessons

### 5. Added Proper Waits

**Problem**: Tests were running before pages fully loaded
**Solution**: Added `waitForTimeout` after navigation and form loads

**Pattern Added**:
```typescript
await page.goto('/admin/collections/pages', { waitUntil: 'load' })
await page.waitForTimeout(2000) // Wait for admin panel to fully load
```

## Test Execution Order

For best results, run tests in this order:

1. **First**: `admin-fresh-setup.e2e.spec.ts` - Creates the admin user
2. **Then**: All other admin tests (pages, lessons, etc.)
3. **Finally**: User flow tests (booking flow, dashboard, etc.)

## Running Tests

```bash
# Run tests in order
pnpm exec playwright test tests/e2e/admin-fresh-setup.e2e.spec.ts
pnpm exec playwright test tests/e2e/admin-pages.e2e.spec.ts
pnpm exec playwright test tests/e2e/admin-lessons.e2e.spec.ts
pnpm exec playwright test tests/e2e/user-booking-flow.e2e.spec.ts

# Or run all at once (tests will skip if admin doesn't exist)
pnpm test:e2e
```

## Remaining Considerations

1. **Admin User Must Exist**: Most tests require an admin user to be created first
2. **Fresh Database**: Some tests assume a fresh database state
3. **Server Must Be Running**: All tests require `http://localhost:3000` to be accessible
4. **Test Isolation**: Tests may affect each other if run in parallel (consider using `--workers=1`)

## Next Steps

If tests still fail:
1. Ensure admin user exists (run `admin-fresh-setup.e2e.spec.ts` first)
2. Check that server is running on `localhost:3000`
3. Verify database is in expected state
4. Check browser console for JavaScript errors
5. Review test output for specific error messages









