# Using Playwright MCP Server for E2E Testing

The Playwright MCP (Model Context Protocol) server allows you to interact with your application through Cursor's AI assistant, making it easier to write and debug e2e tests.

## How It Works

The MCP server is already configured in your Cursor settings (`~/.cursor/mcp.json`). When you ask Cursor's AI to interact with your browser, it uses the Playwright MCP server to:

1. Navigate to pages
2. Interact with elements (click, type, etc.)
3. Take screenshots
4. Inspect page state
5. Generate test code based on what it sees

## Example Workflows

### 1. Exploring the Application

Ask the AI assistant:
```
"Navigate to http://localhost:3000/dashboard and show me what's on the page"
```

The AI will:
- Open the browser
- Navigate to the dashboard
- Take a snapshot of the page
- Describe what it sees

### 2. Writing Tests Based on UI

Ask the AI:
```
"Navigate to the sign-in page, fill out the form with test credentials, and create a test for it"
```

The AI will:
- Navigate to the sign-in page
- Interact with the form
- Generate test code based on the interactions

### 3. Debugging Test Failures

When a test fails, ask:
```
"Take a snapshot of the current page and tell me why the test might be failing"
```

The AI will:
- Capture the current browser state
- Analyze what's visible
- Suggest fixes

### 4. Finding Elements

Ask:
```
"What selectors can I use for the booking button on the dashboard?"
```

The AI will:
- Navigate to the dashboard
- Find the booking button
- Suggest stable selectors

## Integration with Existing Tests

You can use the MCP server to:

1. **Generate test code**: Ask AI to create tests based on user flows
2. **Find selectors**: Discover stable selectors for elements
3. **Debug issues**: Understand why tests are failing
4. **Explore features**: Learn about new features before writing tests

## Example: Creating a New Test

1. **Start the dev server**:
   ```bash
   pnpm dev
   ```

2. **Ask AI to explore**:
   ```
   "Navigate to http://localhost:3000 and show me the main navigation. Then create a test that verifies all navigation links work."
   ```

3. **AI generates test code** that you can copy into your test files

4. **Run the test**:
   ```bash
   pnpm test:e2e
   ```

## Tips

- **Always start the dev server** before asking AI to interact with the app
- **Be specific** about what you want to test
- **Use the generated code as a starting point** - you may need to adjust it
- **Combine MCP exploration with manual test writing** for best results

## Limitations

- The MCP server works with a running application (localhost:3000)
- It can't run your full test suite - use `pnpm test:e2e` for that
- It's best used for exploration and test generation, not test execution

## Next Steps

1. Start your dev server: `pnpm dev`
2. Ask AI to explore your app: "Show me the dashboard page"
3. Generate tests based on what you see
4. Add the tests to your test files
5. Run the full test suite: `pnpm test:e2e`













