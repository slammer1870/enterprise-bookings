# Page Creation E2E Testing Guide

This guide explains how to test the page creation functionality in the bru-grappling admin dashboard, including creating pages with blocks (especially the schedule block).

## Test Files

### 1. `admin-page-creation.e2e.spec.ts`
Standard Playwright E2E tests for page creation functionality.

**Tests included:**
- Navigate to pages collection
- Display page creation form
- Create a homepage with schedule block
- Create homepage with multiple blocks
- Validate required fields
- Reorder blocks
- Delete blocks

### 2. `admin-page-creation-mcp.e2e.spec.ts`
Interactive tests designed to work with the Playwright MCP server for exploration and debugging.

**Tests included:**
- Explore page creation form
- Step-by-step page creation with checkpoints
- Verify schedule block on frontend
- Test all available block types
- Interactive debugging session

## Running the Tests

### Standard Test Execution

```bash
# Run all page creation tests
pnpm exec playwright test admin-page-creation

# Run specific test file
pnpm exec playwright test admin-page-creation.e2e.spec.ts

# Run in headed mode (see the browser)
pnpm exec playwright test admin-page-creation.e2e.spec.ts --headed

# Run in debug mode
pnpm exec playwright test admin-page-creation.e2e.spec.ts --debug

# Run with UI mode
pnpm exec playwright test admin-page-creation.e2e.spec.ts --ui
```

### MCP-Enhanced Testing

The MCP tests are designed to work with Cursor's AI assistant and the Playwright MCP server.

```bash
# Run MCP tests in debug mode for interactive exploration
pnpm exec playwright test admin-page-creation-mcp.e2e.spec.ts --debug

# Run specific MCP test
pnpm exec playwright test -g "MCP: explore page creation form" --debug
```

## Using Playwright MCP Server

The Playwright MCP server allows you to interact with the browser through Cursor's AI assistant during test execution.

### Setup

The MCP server should already be configured in your Cursor settings (`~/.cursor/mcp.json`).

### MCP Commands You Can Use

While a test is running (especially in debug mode), you can ask the AI assistant to:

#### Navigation
- "Navigate to /admin/collections/pages"
- "Go to the page creation form"
- "Click on the 'Create New' button"

#### Inspection
- "Take a snapshot of the current page"
- "What elements are visible on the page?"
- "Show me the form fields"
- "List all available block types"

#### Interaction
- "Click the 'Add Block' button"
- "Fill in the title field with 'Test Page'"
- "Select the Schedule block"
- "Click the Save button"

#### Form Filling
- "Fill in the page creation form with test data"
- "Create a homepage with a schedule block"
- "Add multiple blocks to the page"

#### Debugging
- "Take a screenshot of the current state"
- "Show me the console errors"
- "What happened after clicking save?"

### Example MCP Workflow

1. Start a test in debug mode:
```bash
pnpm exec playwright test -g "MCP: interactive debugging session" --debug
```

2. When the browser opens, ask the AI:
```
"Take a snapshot of the page creation form"
```

3. The AI will show you the current state of the page

4. Continue with commands like:
```
"Fill in the title with 'My Test Page'"
"Click the add block button"
"Show me all available block types"
"Select the Schedule block"
"Save the page"
```

## Test Scenarios

### Scenario 1: Create Basic Homepage with Schedule

```typescript
test('create homepage with schedule block', async ({ page }) => {
  // 1. Navigate to page creation
  await page.goto('/admin/collections/pages/create')
  
  // 2. Fill in title
  await page.fill('input[name="title"]', 'Homepage')
  
  // 3. Fill in slug
  await page.fill('input[name="slug"]', 'home')
  
  // 4. Add schedule block
  await page.click('button:has-text("Add Block")')
  await page.click('button:has-text("Schedule")')
  
  // 5. Save
  await page.click('button:has-text("Save")')
})
```

### Scenario 2: Create Full Homepage with Multiple Blocks

```typescript
test('create full homepage', async ({ page }) => {
  await page.goto('/admin/collections/pages/create')
  
  // Fill basic info
  await page.fill('input[name="title"]', 'Full Homepage')
  await page.fill('input[name="slug"]', 'home')
  
  // Add Hero block
  await page.click('button:has-text("Add Block")')
  await page.click('button:has-text("Hero")')
  
  // Add Schedule block
  await page.click('button:has-text("Add Block")')
  await page.click('button:has-text("Schedule")')
  
  // Add About block
  await page.click('button:has-text("Add Block")')
  await page.click('button:has-text("About")')
  
  // Save
  await page.click('button:has-text("Save")')
})
```

### Scenario 3: Verify Frontend Rendering

```typescript
test('verify schedule block on frontend', async ({ page }) => {
  // 1. Create page with schedule block (see above)
  
  // 2. Navigate to frontend
  await page.goto('/home')
  
  // 3. Verify schedule section exists
  const schedule = page.locator('#schedule')
  await expect(schedule).toBeVisible()
})
```

## Available Block Types

Based on the bru-grappling configuration, the following blocks are available:

1. **Hero** - Main page banner/hero section
2. **About** - About section with content
3. **Learning** - Learning/training information
4. **MeetTheTeam** - Team member profiles
5. **Schedule** - Class schedule display (our focus!)
6. **Testimonials** - Customer testimonials
7. **Contact** - Contact form/information
8. **FormBlock** - Generic form block
9. **Faqs** - Frequently asked questions
10. **HeroWaitlist** - Hero section with waitlist signup

## Schedule Block Details

The Schedule block is defined in:
- **Config**: `src/blocks/schedule/config.ts`
- **Component**: `src/blocks/schedule/index.tsx`
- **Schedule Component**: `src/components/schedule.tsx`

### Schedule Block Configuration

```typescript
export const Schedule: Block = {
  slug: 'schedule',
  interfaceName: 'ScheduleBlock',
  fields: [],
}
```

The schedule block has no additional fields - it simply renders the schedule component which fetches and displays class schedules.

## Troubleshooting

### Test Fails to Find Elements

If tests fail to find form elements, try:

1. **Take a screenshot**:
```typescript
await page.screenshot({ path: 'debug.png', fullPage: true })
```

2. **Use MCP to inspect**:
```
"Take a snapshot and show me what's on the page"
```

3. **Check for loading states**:
```typescript
await page.waitForLoadState('networkidle')
await page.waitForTimeout(2000)
```

### Block Not Appearing

If a block doesn't appear after adding:

1. **Wait for the UI to update**:
```typescript
await page.waitForTimeout(1000)
```

2. **Verify the block was added**:
```typescript
const blockCount = await page.locator('[data-block-type="schedule"]').count()
console.log(`Found ${blockCount} schedule blocks`)
```

3. **Check console for errors**:
```
"Show me the console errors"
```

### Save Button Not Working

If clicking save doesn't work:

1. **Check for validation errors**:
```typescript
const errors = await page.locator('.error, [role="alert"]').allTextContents()
console.log('Validation errors:', errors)
```

2. **Verify required fields are filled**:
```typescript
const title = await page.inputValue('input[name="title"]')
const slug = await page.inputValue('input[name="slug"]')
console.log('Title:', title, 'Slug:', slug)
```

3. **Wait longer for save to complete**:
```typescript
await page.waitForTimeout(5000)
```

## Best Practices

### 1. Use Descriptive Test Names
```typescript
test('should create homepage with schedule block and verify frontend rendering', ...)
```

### 2. Add Checkpoints for Debugging
```typescript
await page.screenshot({ path: `step-${stepNumber}.png` })
```

### 3. Use MCP for Exploration First
Before writing tests, use MCP to explore the UI:
```
"Navigate to /admin/collections/pages/create"
"Show me all the form fields"
"What happens when I click Add Block?"
```

### 4. Handle Timing Issues
```typescript
// Wait for network to be idle
await page.waitForLoadState('networkidle')

// Wait for specific element
await page.waitForSelector('button:has-text("Save")', { state: 'visible' })

// Add explicit waits when needed
await page.waitForTimeout(1000)
```

### 5. Clean Up Test Data
```typescript
test.afterEach(async ({ page }) => {
  // Delete test pages created during tests
  // (implement cleanup logic)
})
```

## Integration with CI/CD

These tests run automatically in CI with the following configuration:

- **Database**: Fresh database created via TestContainer
- **Server**: Started with migrations before tests
- **Retries**: 2 retries on CI for flaky tests
- **Timeout**: 90 seconds per test
- **Reporter**: HTML report generated

## Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/playwright)
- [PayloadCMS Blocks Documentation](https://payloadcms.com/docs/fields/blocks)
- [Main E2E Testing README](./README.md)

## Contributing

When adding new page creation tests:

1. Follow the existing test structure
2. Use the helper functions from `utils/`
3. Add MCP-friendly checkpoints
4. Document any new block types
5. Update this README with new scenarios

## Example: Complete Test Session

Here's a complete example of testing page creation with MCP:

```bash
# 1. Start the test in debug mode
pnpm exec playwright test -g "MCP: interactive debugging session" --debug

# 2. When browser opens, use these AI commands in sequence:

# Inspect the form
"Take a snapshot of the page creation form"

# Fill in basic details
"Fill in the title field with 'My Test Homepage'"
"Fill in the slug field with 'my-test-homepage'"

# Add schedule block
"Click the Add Block button"
"Take a snapshot of the block type selector"
"Click on the Schedule option"
"Take a snapshot to verify the schedule block was added"

# Save the page
"Click the Save button"
"Wait 3 seconds"
"Take a screenshot of the result"

# Verify on frontend
"Navigate to /my-test-homepage"
"Take a snapshot of the frontend page"
"Is the schedule component visible?"
```

This interactive approach helps you:
- Understand the UI flow
- Debug issues in real-time
- Generate accurate test code
- Verify expected behavior

---

Happy Testing! 🎭🧪

