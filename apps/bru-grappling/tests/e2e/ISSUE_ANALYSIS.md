# Test Failure Analysis: App Issues vs Test Issues

This document categorizes test failures into **App Issues** (real bugs/problems) and **Test Issues** (how tests are written).

## 🔴 App Issues (Real Problems)

### 1. **Booking Page Redirect Timing**
**Location**: `apps/bru-grappling/src/app/(frontend)/bookings/[id]/page.tsx:36`
**Issue**: The app uses Next.js server-side `redirect()` which happens during SSR. Tests are checking for client-side navigation, which may not fire the same events.

**Evidence**:
- Tests wait for URL changes but `redirect()` happens server-side
- Test logs show: "navigated to /bookings/1" then "navigated to /complete-booking" but `waitForURL` times out
- The redirect is working (URL changes) but Playwright's `waitForURL` may not detect server-side redirects properly

**Recommendation**: 
- Consider using client-side redirects for better testability, OR
- Tests should check URL immediately after navigation instead of waiting for events

### 2. **Navbar Navigation Items Not Configured in Test DB**
**Location**: `apps/bru-grappling/src/globals/navbar/config.ts:38-44`
**Issue**: Navbar has default values, but if the global isn't initialized in the test database, navigation links won't appear.

**Evidence**:
- Tests skip when links aren't found (correct behavior)
- Default values exist but may not be persisted to DB
- Fresh database = no navbar global = no navigation links

**Recommendation**:
- Add test setup to ensure navbar global is initialized with defaults
- OR make tests more resilient by checking if navbar exists first

### 3. **Role Dropdown Accessibility/Selectors**
**Location**: Payload CMS uses React Select for role dropdown
**Issue**: The dropdown may not be fully accessible or may have timing issues rendering options.

**Evidence**:
- Tests use multiple fallback strategies to find the dropdown
- Options may not be immediately visible after clicking combobox
- React Select may render options in a portal, making them harder to find

**Recommendation**:
- Add `data-testid` attributes to dropdown components
- OR improve React Select configuration for better accessibility
- OR add explicit waits for option rendering

### 4. **Tab State vs URL State Mismatch**
**Location**: `complete-booking` page tabs
**Issue**: Tabs may update their `aria-selected` state without updating the URL, causing test failures.

**Evidence**:
- Tests check for URL changes (`mode=register`) but tabs might use client-side state
- Tab switching works but URL might not update immediately

**Recommendation**:
- Ensure tab changes update URL query params
- OR tests should check tab state (`aria-selected`) in addition to URL

## 🟡 Test Issues (How Tests Are Written)

### 1. **Over-Reliance on Fixed Timeouts**
**Issue**: Many tests use `waitForTimeout()` instead of waiting for actual conditions.

**Examples**:
- `await page.waitForTimeout(2000)` - arbitrary wait
- Should use: `await page.waitForLoadState('networkidle')` or wait for specific elements

**Impact**: Tests are flaky and slow

**Recommendation**: Replace all fixed timeouts with condition-based waits

### 2. **Complex Fallback Strategies for Simple Selectors**
**Issue**: Tests have 4-5 fallback strategies to find elements, suggesting selectors are unstable.

**Example**: Role dropdown test tries:
1. `getByRole('combobox')`
2. Find near "Role" label
3. `input[id*="react-select"]`
4. Find in listbox
5. Click by index

**Impact**: Tests are hard to maintain and debug

**Recommendation**: 
- Add stable selectors (`data-testid`) to components
- OR use more reliable selectors (e.g., by label text)

### 3. **Assuming Elements Exist Without Checking**
**Issue**: Tests assume navigation links, dashboard buttons, etc. exist without verifying setup.

**Example**: Navigation tests expect links that may not be configured

**Impact**: Tests fail when they should skip or handle missing features

**Recommendation**: Tests already handle this well with conditional checks - keep this pattern

### 4. **Server-Side Redirect Detection**
**Issue**: Tests use `waitForURL()` for server-side redirects which may not fire navigation events.

**Example**: Booking redirect test waits for URL change but redirect happens server-side

**Impact**: False negatives - redirect works but test fails

**Recommendation**: 
- Check URL immediately after navigation
- Use `page.url()` instead of `waitForURL()` for server-side redirects
- OR wait for page load state instead

### 5. **Inconsistent Authentication State Checks**
**Issue**: Some tests check auth state, others assume it.

**Example**: Dashboard tests check for logout button, but timing may be off

**Impact**: Tests fail when auth state hasn't fully loaded

**Recommendation**: 
- Always wait for auth state to stabilize
- Use `waitForLoadState('networkidle')` after auth actions
- Check for auth-dependent elements before testing

### 6. **Tab Clicking with Navigation Overlay**
**Issue**: Navigation overlay intercepts clicks on tabs.

**Example**: Tab switching test uses `force: true` to bypass overlay

**Impact**: Tests work but may not reflect real user experience

**Recommendation**: 
- Fix z-index/overlay issues in app
- OR ensure overlay doesn't block interactive elements
- OR use `force: true` as temporary workaround

## 📊 Summary

### App Issues (Need Code Changes):
1. ✅ Booking redirect works but test detection is wrong - **Test Issue**
2. ✅ Navbar not initialized in test DB - **Test Setup Issue**
3. ⚠️ Role dropdown may have accessibility/timing issues - **Potential App Issue**
4. ⚠️ Tab state doesn't update URL - **Potential App Issue**

### Test Issues (Need Test Improvements):
1. Too many fixed timeouts → Use condition-based waits
2. Complex fallback selectors → Add stable test IDs
3. Server-side redirect detection → Check URL directly
4. Inconsistent auth state checks → Standardize auth waiting
5. Tab clicking workarounds → Fix overlay or document limitation

## 🎯 Priority Fixes

### High Priority (App):
1. **Add `data-testid` attributes** to key interactive elements (dropdowns, buttons, forms)
2. **Ensure tab state updates URL** query params for better testability
3. **Initialize navbar global** in test database setup

### High Priority (Tests):
1. **Replace fixed timeouts** with condition-based waits
2. **Simplify selectors** using test IDs where available
3. **Fix redirect detection** for server-side redirects
4. **Standardize auth state waiting** across all tests

### Medium Priority:
1. Improve React Select accessibility configuration
2. Fix navigation overlay z-index issues
3. Add test utilities for common patterns (auth, navigation, etc.)


