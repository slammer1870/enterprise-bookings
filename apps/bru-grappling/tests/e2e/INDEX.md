# E2E Testing Documentation Index

Welcome to the bru-grappling E2E testing documentation! This index helps you find the right documentation for your needs.

## 📚 Documentation Overview

### Getting Started

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **[README.md](./README.md)** | Main E2E testing guide | First time setup, general testing info |
| **[QUICK_START.md](./QUICK_START.md)** | Quick start guide for page creation testing | Want to start testing immediately |
| **[INDEX.md](./INDEX.md)** | This file - navigation guide | Finding the right documentation |

### Page Creation Testing

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **[PAGE_CREATION_TESTING.md](./PAGE_CREATION_TESTING.md)** | Comprehensive page creation guide | Deep dive into page creation testing |
| **[MCP_USAGE_EXAMPLE.md](./MCP_USAGE_EXAMPLE.md)** | MCP server usage examples | Learning to use MCP for interactive testing |
| **[PAGE_CREATION_SUMMARY.md](./PAGE_CREATION_SUMMARY.md)** | Summary of all page creation testing | Overview and reference |

## 🎯 Choose Your Path

### Path 1: I want to run tests right now
1. Start here: **[QUICK_START.md](./QUICK_START.md)**
2. Run: `pnpm exec playwright test demo-page-creation --headed`
3. Watch the magic happen! ✨

### Path 2: I want to learn about page creation testing
1. Start here: **[PAGE_CREATION_TESTING.md](./PAGE_CREATION_TESTING.md)**
2. Read about test scenarios and block types
3. Try the examples
4. Run the tests

### Path 3: I want to use MCP for interactive testing
1. Start here: **[MCP_USAGE_EXAMPLE.md](./MCP_USAGE_EXAMPLE.md)**
2. Learn the MCP commands
3. Start a browser and interact with it
4. Ask AI to help you test

### Path 4: I want to understand everything
1. Start here: **[README.md](./README.md)**
2. Then: **[PAGE_CREATION_SUMMARY.md](./PAGE_CREATION_SUMMARY.md)**
3. Then: **[PAGE_CREATION_TESTING.md](./PAGE_CREATION_TESTING.md)**
4. Then: **[MCP_USAGE_EXAMPLE.md](./MCP_USAGE_EXAMPLE.md)**
5. Finally: Try the tests!

### Path 5: I'm debugging a test failure
1. Check: **[PAGE_CREATION_TESTING.md](./PAGE_CREATION_TESTING.md)** - Troubleshooting section
2. Use: **[MCP_USAGE_EXAMPLE.md](./MCP_USAGE_EXAMPLE.md)** - Debug with MCP
3. Run: `pnpm exec playwright test --debug` to step through

## 📁 Test Files

### Automated Tests

| File | Description | Run Command |
|------|-------------|-------------|
| **admin-page-creation.e2e.spec.ts** | Standard automated tests | `pnpm exec playwright test admin-page-creation.e2e` |
| **admin-page-creation-mcp.e2e.spec.ts** | MCP-enhanced tests | `pnpm exec playwright test admin-page-creation-mcp.e2e` |
| **demo-page-creation.e2e.spec.ts** | Demo test with detailed logging | `pnpm exec playwright test demo-page-creation --headed` |

### Other Test Files

| File | Description |
|------|-------------|
| **admin-fresh-setup.e2e.spec.ts** | Admin initial setup tests |
| **admin-lesson-creation.e2e.spec.ts** | Lesson creation tests |

## 🛠️ Utility Files

| File | Purpose |
|------|---------|
| **utils/auth.ts** | Authentication helpers (signIn, signOut, etc.) |
| **utils/helpers.ts** | General test helpers (waitForPageLoad, etc.) |
| **utils/admin-setup.ts** | Admin setup utilities |
| **fixtures.ts** | Playwright fixtures for authenticated tests |
| **global-setup.ts** | Global test setup (database, etc.) |
| **global-teardown.ts** | Global test teardown |

## 🎬 Quick Commands

### Run All Tests
```bash
pnpm test:e2e
```

### Run Page Creation Tests
```bash
# Standard tests
pnpm exec playwright test admin-page-creation

# MCP tests
pnpm exec playwright test admin-page-creation-mcp --debug

# Demo test
pnpm exec playwright test demo-page-creation --headed
```

### Debug Tests
```bash
# Debug mode
pnpm exec playwright test --debug

# UI mode
pnpm exec playwright test --ui

# Headed mode (see browser)
pnpm exec playwright test --headed
```

## 🔍 Find What You Need

### I need to...

**Create a page with a schedule block**
→ [QUICK_START.md](./QUICK_START.md) - Scenario 1

**Test multiple blocks**
→ [PAGE_CREATION_TESTING.md](./PAGE_CREATION_TESTING.md) - Scenario 2

**Use MCP commands**
→ [MCP_USAGE_EXAMPLE.md](./MCP_USAGE_EXAMPLE.md) - Complete Example Session

**Debug a test failure**
→ [PAGE_CREATION_TESTING.md](./PAGE_CREATION_TESTING.md) - Troubleshooting

**Understand available blocks**
→ [PAGE_CREATION_TESTING.md](./PAGE_CREATION_TESTING.md) - Available Block Types

**Write new tests**
→ [README.md](./README.md) - Writing New Tests

**Set up authentication**
→ [README.md](./README.md) - Test Utilities

## 📖 Documentation by Topic

### Authentication
- [README.md](./README.md) - Authentication Helpers section
- `utils/auth.ts` - Implementation

### Page Creation
- [PAGE_CREATION_TESTING.md](./PAGE_CREATION_TESTING.md) - Complete guide
- [QUICK_START.md](./QUICK_START.md) - Quick reference
- [PAGE_CREATION_SUMMARY.md](./PAGE_CREATION_SUMMARY.md) - Overview

### MCP Server
- [MCP_USAGE_EXAMPLE.md](./MCP_USAGE_EXAMPLE.md) - Detailed examples
- [README.md](./README.md) - MCP overview
- [QUICK_START.md](./QUICK_START.md) - Quick MCP commands

### Blocks
- [PAGE_CREATION_TESTING.md](./PAGE_CREATION_TESTING.md) - Available Block Types
- [PAGE_CREATION_SUMMARY.md](./PAGE_CREATION_SUMMARY.md) - Block Types Available

### Troubleshooting
- [PAGE_CREATION_TESTING.md](./PAGE_CREATION_TESTING.md) - Troubleshooting section
- [MCP_USAGE_EXAMPLE.md](./MCP_USAGE_EXAMPLE.md) - Troubleshooting MCP Issues
- [QUICK_START.md](./QUICK_START.md) - Troubleshooting section

## 🎓 Learning Path

### Beginner
1. Read [QUICK_START.md](./QUICK_START.md)
2. Run demo test: `pnpm exec playwright test demo-page-creation --headed`
3. Watch what happens
4. Try modifying the test

### Intermediate
1. Read [PAGE_CREATION_TESTING.md](./PAGE_CREATION_TESTING.md)
2. Try different test scenarios
3. Write your own test
4. Use MCP to explore: [MCP_USAGE_EXAMPLE.md](./MCP_USAGE_EXAMPLE.md)

### Advanced
1. Read all documentation
2. Write complex test scenarios
3. Use MCP for debugging
4. Contribute new tests
5. Optimize test performance

## 🚀 Next Steps

After reading the documentation:

1. **Run the demo test** to see everything in action
2. **Try MCP commands** to interact with the browser
3. **Write your own test** for a specific scenario
4. **Share your findings** with the team
5. **Contribute improvements** to the test suite

## 📞 Getting Help

If you're stuck:

1. Check the **Troubleshooting** sections in the docs
2. Run tests with `--debug` flag to inspect
3. Use **MCP commands** to explore the UI
4. Take **screenshots** to document issues
5. Ask the **AI assistant** for help

## 🎯 Common Tasks

| Task | Documentation | Command |
|------|---------------|---------|
| Run all tests | [README.md](./README.md) | `pnpm test:e2e` |
| Create page with schedule | [QUICK_START.md](./QUICK_START.md) | See Scenario 1 |
| Debug test failure | [PAGE_CREATION_TESTING.md](./PAGE_CREATION_TESTING.md) | `--debug` flag |
| Use MCP interactively | [MCP_USAGE_EXAMPLE.md](./MCP_USAGE_EXAMPLE.md) | Ask AI |
| Write new test | [README.md](./README.md) | Follow examples |

## 📊 Documentation Stats

- **Total Documentation Files**: 6 (+ this index)
- **Total Test Files**: 3 (page creation focused)
- **Total Lines of Documentation**: ~1,500+
- **Test Coverage**: 7+ test scenarios
- **Block Types Tested**: 10 available blocks

## ✅ Quick Reference

### Test Commands
```bash
# All tests
pnpm test:e2e

# Page creation
pnpm exec playwright test admin-page-creation

# Demo
pnpm exec playwright test demo-page-creation --headed

# Debug
pnpm exec playwright test --debug
```

### MCP Commands
```
"Take a snapshot"
"Navigate to [URL]"
"Click [element]"
"Fill in [field] with [value]"
```

### Test Users
```typescript
TEST_USERS.admin.email: 'admin@brugrappling.ie'
TEST_USERS.admin.password: 'TestPassword123!'
```

---

**Need help?** Start with [QUICK_START.md](./QUICK_START.md) or ask the AI assistant!

**Ready to test?** Run: `pnpm exec playwright test demo-page-creation --headed`

Happy Testing! 🎭✨

