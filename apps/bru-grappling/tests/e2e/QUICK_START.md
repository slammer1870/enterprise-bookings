# Quick Start: Page Creation Testing with MCP

This is a quick start guide to get you testing page creation with the Playwright MCP server right away!

## Prerequisites

1. **Start the app**:
```bash
cd apps/bru-grappling
pnpm dev
```

2. **Ensure admin user exists**:
- Email: `admin@brugrappling.ie`
- Password: `TestPassword123!`

## Option 1: Run Standard Tests (Automated)

Run the automated page creation tests:

```bash
# Run all page creation tests
pnpm exec playwright test admin-page-creation

# Run in headed mode to watch
pnpm exec playwright test admin-page-creation --headed

# Run specific test
pnpm exec playwright test -g "should create a homepage with schedule block"
```

## Option 2: Use MCP for Interactive Testing

### Step 1: Ask the AI to Start Testing

In Cursor, ask the AI:

```
"Start a browser and navigate to http://localhost:3000/admin/login"
```

### Step 2: Login

```
"Fill in the login form with:
- Email: admin@brugrappling.ie
- Password: TestPassword123!
Then click the login button"
```

### Step 3: Navigate to Pages

```
"Navigate to the pages collection at /admin/collections/pages"
```

### Step 4: Create a New Page

```
"Click the Create New button"
```

### Step 5: Fill in the Form

```
"Fill in the page creation form:
- Title: My Test Page
- Slug: my-test-page"
```

### Step 6: Add Schedule Block

```
"Click the Add Block button and select the Schedule block"
```

### Step 7: Save

```
"Click the Save button and wait for it to complete"
```

### Step 8: Verify on Frontend

```
"Navigate to http://localhost:3000/my-test-page and take a snapshot"
```

## Option 3: Run MCP Tests in Debug Mode

Run the MCP tests with debugging enabled:

```bash
# Run MCP test in debug mode
pnpm exec playwright test admin-page-creation-mcp --debug

# Run specific MCP test
pnpm exec playwright test -g "MCP: create homepage with schedule block" --debug
```

When the browser opens, you can:
- Use the Playwright Inspector to step through
- Use MCP commands to interact with the page
- Take snapshots at any point

## Common MCP Commands

### Inspection
```
"Take a snapshot of the current page"
"What form fields are visible?"
"Show me all the buttons"
"List all available block types"
```

### Navigation
```
"Navigate to [URL]"
"Click on [element]"
"Go back to the previous page"
```

### Form Interaction
```
"Fill in [field] with [value]"
"Click the [button name] button"
"Select [option] from the dropdown"
```

### Verification
```
"Is [element] visible?"
"What is the current URL?"
"Are there any error messages?"
"Take a screenshot"
```

## Quick Test Scenarios

### Scenario 1: Minimal Homepage
```
1. Create page with title "Home" and slug "home"
2. Add Schedule block
3. Save
4. Verify on frontend
```

### Scenario 2: Full Homepage
```
1. Create page with title "Full Home" and slug "full-home"
2. Add Hero block
3. Add Schedule block
4. Add About block
5. Add Contact block
6. Save
7. Verify all blocks on frontend
```

### Scenario 3: Schedule-Only Page
```
1. Create page with title "Schedule" and slug "schedule"
2. Add only Schedule block
3. Save
4. Verify schedule component renders on frontend
```

## Troubleshooting

### Can't find Add Block button
```
"Take a snapshot and show me what's on the page"
"Scroll down to see more of the form"
```

### Block not appearing after adding
```
"Wait 2 seconds and take another snapshot"
"Refresh the page and try again"
```

### Save button not working
```
"Are there any validation errors shown?"
"Is the Save button enabled?"
"What happens when I click Save?"
```

### Frontend page not found
```
"Did the page save successfully?"
"Navigate to /admin/collections/pages and verify the page exists"
"Check the slug is correct"
```

## Next Steps

After successfully creating a page with a schedule block:

1. **Explore other blocks**: Try adding Hero, About, Contact blocks
2. **Test reordering**: Try moving blocks up and down
3. **Test deletion**: Try removing blocks
4. **Write tests**: Convert your MCP interactions into automated tests
5. **Share findings**: Document any issues or improvements

## Resources

- [Full Page Creation Testing Guide](./PAGE_CREATION_TESTING.md)
- [Detailed MCP Usage Examples](./MCP_USAGE_EXAMPLE.md)
- [Main E2E Testing README](./README.md)

## Tips

💡 **Start with MCP exploration** before writing tests - it's faster and helps you understand the UI

💡 **Take screenshots at each step** to document your testing process

💡 **Use descriptive names** for test pages so you can find them later

💡 **Clean up test pages** after testing to keep the admin panel tidy

💡 **Ask the AI for help** if you get stuck - it can see what's on the page!

---

Happy Testing! 🚀

