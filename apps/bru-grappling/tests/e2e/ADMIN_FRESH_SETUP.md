# Admin Fresh Setup E2E Tests

This document describes the e2e tests created for the admin workflow when starting with a fresh database (after running `migrate:fresh`).

## Test Files Created

### 1. `admin-fresh-setup.e2e.spec.ts`
Comprehensive tests for the initial admin setup workflow:

- **Redirect to create-first-user**: Verifies that navigating to `/admin` redirects to `/admin/create-first-user` when no users exist
- **Form display**: Checks that all required form fields are visible
- **Create admin user**: Tests the complete flow of creating the first admin user with:
  - Email, password, confirm password, name fields
  - Email verified checkbox
  - Admin role selection from dropdown
  - Successful creation and redirect to admin dashboard
- **Form validation**: Tests required field validation and password confirmation matching

### 2. Updated `admin.e2e.spec.ts`
Enhanced the existing admin test with better selectors based on MCP exploration:

- Uses `getByRole()` selectors for more reliable element selection
- Properly handles the React Select dropdown for role selection
- Includes email verified checkbox interaction
- More robust waiting and assertions

## Key Workflow Covered

1. **Fresh Database State**
   - Navigate to `/admin`
   - Automatically redirected to `/admin/create-first-user`

2. **Create First Admin User**
   - Fill in email: `admin@brugrappling.ie`
   - Fill in password: `TestPassword123!`
   - Confirm password: `TestPassword123!`
   - Fill in name: `Admin User`
   - Check "Email Verified" checkbox
   - Select "Admin" role from dropdown
   - Click "Create" button

3. **Post-Creation**
   - Redirected to `/admin` dashboard
   - Admin panel navigation is visible
   - Can access admin collections

## Selectors Used

Based on MCP browser exploration, the following selectors are most reliable:

- **Email field**: `page.getByRole('textbox', { name: 'Email *' })`
- **Password field**: `page.getByRole('textbox', { name: 'New Password' })`
- **Confirm Password**: `page.getByRole('textbox', { name: 'Confirm Password' })`
- **Name field**: `page.getByRole('textbox', { name: 'Name' })`
- **Email Verified checkbox**: `page.getByRole('checkbox', { name: 'Email Verified *' })`
- **Role dropdown**: `page.locator('input[id*="react-select"][id*="_r_c_"]')`
- **Admin option**: `page.getByRole('option', { name: 'Admin' })`
- **Create button**: `page.getByRole('button', { name: 'Create' })`

## Running the Tests

```bash
# Run all admin fresh setup tests
pnpm exec playwright test tests/e2e/admin-fresh-setup.e2e.spec.ts

# Run the updated admin tests
pnpm exec playwright test tests/e2e/admin.e2e.spec.ts

# Run all e2e tests
pnpm test:e2e
```

## Notes

- These tests assume a fresh database (run `migrate:fresh` before running tests)
- The tests use the Playwright MCP server to explore the UI and create reliable selectors
- All tests include proper waits and timeouts for async operations
- The role dropdown uses React Select, which requires special handling (click to open, then select option)











