# E2E Testing with Playwright

This directory contains end-to-end tests for the bru-grappling application using Playwright.

## Setup

The Playwright MCP server is configured in your Cursor settings (`~/.cursor/mcp.json`). This allows you to use AI assistance to interact with the browser and generate tests.

## Test Structure

```
tests/e2e/
├── utils/                              # Test utilities and helpers
│   ├── auth.ts                         # Authentication helpers
│   ├── helpers.ts                      # General test helpers
│   └── admin-setup.ts                  # Admin setup utilities
├── fixtures.ts                         # Playwright fixtures for authenticated tests
├── admin-fresh-setup.e2e.spec.ts      # Admin initial setup tests
├── admin-lesson-creation.e2e.spec.ts  # Lesson creation tests
├── admin-page-creation.e2e.spec.ts    # Page creation tests (NEW)
├── admin-page-creation-mcp.e2e.spec.ts # Page creation with MCP (NEW)
├── global-setup.ts                     # Global test setup
├── global-teardown.ts                  # Global test teardown
├── README.md                           # This file
├── PAGE_CREATION_TESTING.md           # Page creation testing guide (NEW)
└── MCP_USAGE_EXAMPLE.md               # MCP usage examples (NEW)
```

## Running Tests

### Run all e2e tests
```bash
pnpm test:e2e
```

### Run specific test file
```bash
pnpm exec playwright test tests/e2e/admin-lesson-creation.e2e.spec.ts
```

### Run page creation tests
```bash
# Standard page creation tests
pnpm exec playwright test admin-page-creation.e2e.spec.ts

# MCP-enhanced page creation tests
pnpm exec playwright test admin-page-creation-mcp.e2e.spec.ts --debug
```

### Run tests in headed mode (see browser)
```bash
pnpm exec playwright test --headed
```

### Run tests in debug mode
```bash
pnpm exec playwright test --debug
```

### Run tests with UI mode
```bash
pnpm exec playwright test --ui
```

## Using Playwright MCP Server

The Playwright MCP server allows you to interact with the browser through Cursor's AI assistant. You can:

1. **Navigate pages**: Ask the AI to navigate to specific routes
2. **Interact with elements**: Click buttons, fill forms, etc.
3. **Generate tests**: Ask the AI to create tests based on what it sees
4. **Debug tests**: Use the browser snapshot to understand test failures

### Example: Using MCP to explore the app

You can ask the AI assistant:
- "Navigate to the dashboard and show me what's there"
- "Click on the sign in button and fill out the form"
- "Take a screenshot of the booking page"
- "What elements are visible on the schedule component?"

### Detailed MCP Guides

For comprehensive guides on using MCP with page creation tests:
- **[Page Creation Testing Guide](./PAGE_CREATION_TESTING.md)** - Complete guide to testing page creation with blocks
- **[MCP Usage Examples](./MCP_USAGE_EXAMPLE.md)** - Step-by-step examples of using MCP for interactive testing

## Test Utilities

### Authentication Helpers (`utils/auth.ts`)

```typescript
import { signIn, signUp, signOut, TEST_USERS } from './utils/auth'

// Sign in a user
await signIn(page, TEST_USERS.admin.email, TEST_USERS.admin.password)

// Sign up a new user
await signUp(page, 'user@example.com', 'password123', 'User Name')

// Sign out
await signOut(page)
```

### General Helpers (`utils/helpers.ts`)

```typescript
import { waitForPageLoad, fillField, clickButton } from './utils/helpers'

// Wait for page to load
await waitForPageLoad(page, '/dashboard')

// Fill a form field
await fillField(page, 'input[name="email"]', 'test@example.com')

// Click a button
await clickButton(page, 'button:has-text("Submit")')
```

## Test Fixtures

Use the authenticated fixture for tests that require a signed-in user:

```typescript
import { test, expect } from './fixtures'

test('should access dashboard', async ({ authenticatedPage }) => {
  const { page } = authenticatedPage
  await page.goto('/dashboard')
  // User is already signed in
})
```

## Writing New Tests

1. **Use test utilities**: Leverage the helpers in `utils/` to keep tests DRY
2. **Use descriptive test names**: Make it clear what each test verifies
3. **Group related tests**: Use `test.describe()` to organize tests
4. **Use fixtures**: Use authenticated fixtures when you need a signed-in user
5. **Handle async operations**: Always wait for navigation and element visibility

### Example Test

```typescript
import { test, expect } from '@playwright/test'
import { signIn, TEST_USERS } from './utils/auth'

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    await signIn(page, TEST_USERS.admin.email, TEST_USERS.admin.password)
    await page.goto('/my-feature')
    
    const element = page.locator('button:has-text("Click Me")')
    await expect(element).toBeVisible()
    await element.click()
    
    await expect(page).toHaveURL(/\/success/)
  })
})
```

## CI/CD

Tests run automatically in CI. The configuration includes:
- Database setup via TestContainer
- Server startup with migrations
- Test execution with retries
- Report generation

## Debugging

1. **Use Playwright Inspector**: Run tests with `--debug` flag
2. **Use UI Mode**: Run tests with `--ui` for interactive debugging
3. **Take Screenshots**: Use `takeScreenshot()` helper for debugging
4. **Check Network**: Use `page.waitForResponse()` to debug API calls
5. **Use MCP Browser Snapshot**: Ask AI to show you the current page state

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Use `beforeEach`/`afterEach` for setup/teardown
3. **Selectors**: Prefer stable selectors (data-testid, role, text)
4. **Waits**: Always wait for elements to be visible before interacting
5. **Timeouts**: Use appropriate timeouts for slow operations
6. **Error Handling**: Handle expected errors gracefully













