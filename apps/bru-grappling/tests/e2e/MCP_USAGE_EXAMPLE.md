# Playwright MCP Server Usage Example

This guide demonstrates how to use the Playwright MCP server with Cursor's AI assistant to test page creation in the bru-grappling admin dashboard.

## What is the Playwright MCP Server?

The Playwright MCP (Model Context Protocol) server allows you to control a browser through natural language commands via Cursor's AI assistant. Instead of writing code, you can ask the AI to interact with the browser for you.

## Prerequisites

1. Playwright MCP server configured in `~/.cursor/mcp.json`
2. bru-grappling app running on `http://localhost:3000`
3. Fresh database with admin user created

## Interactive Testing Session

### Step 1: Start the Browser

Ask the AI:
```
"Start a browser and navigate to http://localhost:3000/admin"
```

The AI will use the MCP server to:
- Launch a browser
- Navigate to the admin panel
- Show you what's on the page

### Step 2: Login

Ask the AI:
```
"Fill in the login form with email 'admin@brugrappling.ie' and password 'TestPassword123!' and click login"
```

The AI will:
- Find the email and password fields
- Fill them in
- Click the login button
- Wait for navigation

### Step 3: Navigate to Pages

Ask the AI:
```
"Navigate to the pages collection and take a snapshot"
```

The AI will:
- Click on the Pages link in the admin sidebar
- Take a snapshot of the page
- Show you what's visible

### Step 4: Create a New Page

Ask the AI:
```
"Click the 'Create New' button to create a new page"
```

### Step 5: Fill in Page Details

Ask the AI:
```
"Fill in the page creation form:
- Title: 'Test Homepage'
- Slug: 'test-homepage'"
```

The AI will:
- Find the title field and fill it
- Find the slug field and fill it
- Confirm the fields are filled

### Step 6: Add a Schedule Block

Ask the AI:
```
"Click the 'Add Block' button and show me the available block types"
```

The AI will:
- Click the Add Block button
- Take a snapshot showing all block options
- List the available blocks

Then ask:
```
"Select the 'Schedule' block from the list"
```

### Step 7: Verify the Block Was Added

Ask the AI:
```
"Take a snapshot of the form to verify the schedule block was added"
```

The AI will:
- Take a screenshot
- Show you the current state
- Confirm the block is present

### Step 8: Save the Page

Ask the AI:
```
"Click the Save button and wait for the page to save"
```

The AI will:
- Find and click the Save button
- Wait for the save operation to complete
- Show you the result

### Step 9: Verify on Frontend

Ask the AI:
```
"Navigate to http://localhost:3000/test-homepage and take a snapshot"
```

The AI will:
- Navigate to the frontend page
- Take a snapshot
- Show you how the page renders

Then ask:
```
"Is the schedule component visible on the page?"
```

The AI will:
- Inspect the page
- Look for the schedule component
- Tell you if it's visible and where

## Advanced MCP Commands

### Inspect Elements

```
"What form fields are visible on this page?"
"Show me all the buttons on the page"
"What is the current URL?"
"Are there any error messages displayed?"
```

### Interact with Forms

```
"Fill in all required fields with test data"
"Clear the title field"
"Check the 'published' checkbox"
"Select 'Draft' from the status dropdown"
```

### Work with Blocks

```
"Add a Hero block"
"Add a Schedule block"
"Add an About block"
"How many blocks are currently added?"
"Delete the last block"
"Reorder the blocks - move Schedule to the top"
```

### Debug Issues

```
"Take a screenshot of the current page"
"Show me the console errors"
"What network requests were made?"
"Is there a loading spinner visible?"
"Wait 5 seconds and take another snapshot"
```

### Verify Results

```
"Is the page saved successfully?"
"What success message is displayed?"
"Navigate back to the pages list"
"Is 'Test Homepage' in the list of pages?"
```

## Complete Example Session

Here's a complete conversation you might have with the AI:

**You:** "Start a browser and navigate to http://localhost:3000/admin/login"

**AI:** *Starts browser, navigates, shows snapshot*

**You:** "Login with admin@brugrappling.ie and TestPassword123!"

**AI:** *Fills form, clicks login, confirms success*

**You:** "Go to the pages collection"

**AI:** *Navigates to /admin/collections/pages*

**You:** "Create a new page called 'Schedule Page' with slug 'schedule'"

**AI:** *Clicks Create New, fills in title and slug*

**You:** "Add a Hero block and a Schedule block"

**AI:** *Clicks Add Block twice, selects Hero and Schedule*

**You:** "Take a screenshot showing both blocks"

**AI:** *Takes screenshot, shows the form with both blocks*

**You:** "Save the page"

**AI:** *Clicks Save, waits for completion*

**You:** "Now go to the frontend at /schedule and verify the schedule component is visible"

**AI:** *Navigates to frontend, checks for schedule component, confirms it's visible*

**You:** "Perfect! Close the browser"

**AI:** *Closes browser, ends session*

## Using MCP with Playwright Tests

You can also use MCP while running Playwright tests in debug mode:

```bash
# Start test in debug mode
pnpm exec playwright test admin-page-creation-mcp.e2e.spec.ts --debug
```

When the test pauses, you can use MCP commands to:
- Inspect the current state
- Try different interactions
- Debug test failures
- Generate new test code

Example:
```
"The test is failing at the 'Add Block' step. Take a snapshot and show me what's on the page"
"Try clicking the Add Block button using a different selector"
"What error is shown in the console?"
```

## Benefits of Using MCP

### 1. Rapid Exploration
- Quickly explore the UI without writing code
- Try different interactions to see what works
- Understand the application flow

### 2. Interactive Debugging
- Debug test failures in real-time
- Try different selectors and approaches
- See immediate feedback

### 3. Test Generation
- Use MCP to explore the UI
- Ask AI to generate test code based on interactions
- Refine tests iteratively

### 4. Documentation
- Take screenshots at each step
- Generate visual documentation
- Share findings with team

### 5. Accessibility Testing
- Ask AI to check for accessibility issues
- Verify ARIA labels and roles
- Test keyboard navigation

## Common MCP Patterns

### Pattern 1: Explore-Then-Code
```
1. Use MCP to explore the UI
2. Document the successful interactions
3. Convert to Playwright test code
4. Run automated tests
```

### Pattern 2: Debug-Then-Fix
```
1. Test fails
2. Use MCP to inspect the failure point
3. Try different approaches with MCP
4. Update test code with working solution
```

### Pattern 3: Verify-Then-Assert
```
1. Use MCP to verify expected behavior
2. Take screenshots as evidence
3. Write assertions based on findings
4. Add to test suite
```

## Tips for Effective MCP Usage

### Be Specific
❌ "Click the button"
✅ "Click the 'Add Block' button in the layout section"

### Break Down Complex Tasks
❌ "Create a complete homepage with all blocks"
✅ "First, fill in the title. Then, add a Hero block. Then, add a Schedule block."

### Verify Each Step
✅ "Take a snapshot after adding the block to verify it was added"
✅ "Is the Save button now enabled?"

### Use Natural Language
✅ "Show me what's on the page"
✅ "Is there an error message?"
✅ "What happened after I clicked Save?"

### Ask for Explanations
✅ "Why did the form submission fail?"
✅ "What's the difference between these two selectors?"
✅ "How should I select the Schedule block option?"

## Troubleshooting MCP Issues

### Browser Doesn't Start
```
"Check if the Playwright MCP server is running"
"Restart the MCP server"
"Try navigating to a simple page first"
```

### Elements Not Found
```
"Take a snapshot to see what's actually on the page"
"Wait 3 seconds for the page to load, then try again"
"Show me all buttons on the page"
```

### Actions Don't Work
```
"Is the element visible?"
"Is the element enabled?"
"Try clicking using coordinates instead"
```

### Slow Performance
```
"Wait for the page to finish loading"
"Check if there are any pending network requests"
"Take a screenshot to see the current state"
```

## Next Steps

After using MCP to explore and understand the page creation flow:

1. **Document your findings** in test files
2. **Write automated tests** based on successful MCP interactions
3. **Create helper functions** for common operations
4. **Share knowledge** with your team
5. **Iterate and improve** test coverage

## Resources

- [MCP Documentation](https://modelcontextprotocol.io/)
- [Playwright MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/playwright)
- [Cursor MCP Integration](https://docs.cursor.com/advanced/mcp)
- [bru-grappling E2E Tests](./README.md)

---

**Pro Tip**: Start every testing session with MCP exploration before writing code. It saves time and leads to better tests! 🎭✨

