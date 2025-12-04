# Admin and User Workflow E2E Tests

This document describes the comprehensive e2e tests created for the admin and user workflows in the bru-grappling application.

## Test Files Created

### 1. `admin-pages.e2e.spec.ts` - Admin Creating Pages with Blocks

Tests the workflow of an admin creating a home page with content blocks:

- **Create page with title and slug**: Verifies basic page creation
- **Open block drawer**: Tests the "Add Layout" functionality
- **Display available blocks**: Verifies all block types are available (Hero, About, Schedule, etc.)
- **Add Hero block**: Tests adding a single block to a page
- **Add multiple blocks**: Tests adding multiple blocks to a page
- **Save page with blocks**: Tests the complete save workflow
- **Search for blocks**: Tests the block search functionality

**Available Blocks Discovered:**
- Hero
- About
- Learning
- Meet The Team
- Schedule
- Testimonials
- Contact
- Form Block
- Faq
- Hero Waitlist

### 2. `admin-lessons.e2e.spec.ts` - Admin Creating Lessons

Tests the workflow of an admin creating lessons to populate the schedule:

- **Navigate to Lessons collection**: Tests navigation from admin dashboard
- **Open create lesson form**: Tests accessing the lesson creation page
- **Display lesson form fields**: Verifies form fields are visible
- **Create a lesson**: Tests creating a lesson with required fields
- **View lessons list**: Tests viewing the lessons collection
- **Navigate from dashboard**: Tests navigation paths to lessons

### 3. `user-booking-flow.e2e.spec.ts` - User Booking Flow

Tests the complete workflow of a user creating bookings:

- **Navigate to sign up**: Tests user registration access
- **Create new user account**: Tests the sign-up process
- **Access dashboard after sign in**: Tests post-authentication flow
- **View schedule on dashboard**: Tests schedule visibility
- **Navigate to booking page**: Tests clicking on lessons to book
- **Display booking details**: Tests booking page content
- **Protect booking routes**: Tests authentication requirements
- **Complete booking flow**: Tests the full booking process
- **View home page**: Tests viewing the created home page

## Workflow Coverage

### Admin Workflow (Fresh Application)

1. **Create Home Page**
   - Navigate to Pages collection
   - Create new page with title "Home" and slug "home"
   - Add blocks (Hero, About, Schedule, etc.)
   - Save page

2. **Create Lessons**
   - Navigate to Lessons collection
   - Create new lessons
   - Fill in lesson details (instructor, time, date, etc.)
   - Save lessons

### User Workflow

1. **Sign Up / Sign In**
   - Create account or sign in
   - Access dashboard

2. **View Schedule**
   - See available lessons on dashboard
   - Navigate to booking page

3. **Create Booking**
   - Click on available lesson
   - View booking details
   - Complete booking process

## Running the Tests

```bash
# Run all admin page tests
pnpm exec playwright test tests/e2e/admin-pages.e2e.spec.ts

# Run all admin lesson tests
pnpm exec playwright test tests/e2e/admin-lessons.e2e.spec.ts

# Run all user booking flow tests
pnpm exec playwright test tests/e2e/user-booking-flow.e2e.spec.ts

# Run all workflow tests
pnpm exec playwright test tests/e2e/admin-pages.e2e.spec.ts tests/e2e/admin-lessons.e2e.spec.ts tests/e2e/user-booking-flow.e2e.spec.ts

# Run all e2e tests
pnpm test:e2e
```

## Test Prerequisites

1. **Fresh Database**: Run `migrate:fresh` before running tests
2. **Admin User**: Tests assume an admin user exists (created via admin-fresh-setup tests)
3. **Server Running**: Dev server should be running on `http://localhost:3000`

## Key Selectors Used

Based on MCP browser exploration:

- **Page Creation**:
  - Title: `page.getByRole('textbox', { name: 'Title *' })`
  - Slug: `page.getByRole('textbox', { name: 'Slug *' })`
  - Add Layout: `page.getByRole('button', { name: 'Add Layout' })`
  - Blocks: `page.getByRole('button', { name: 'Hero', exact: true })`

- **Navigation**:
  - Collections: `page.getByRole('link', { name: 'Lessons' })`
  - Create New: `page.getByRole('link', { name: /create new/i })`

- **User Flow**:
  - Dashboard: `/dashboard`
  - Schedule: `#schedule, [id*="schedule"]`
  - Booking Links: `a[href*="/bookings/"]`

## Notes

- Tests use conditional logic to handle cases where content may not exist (e.g., no lessons yet)
- Some tests use `test.skip()` when prerequisites aren't met
- Tests include proper waits and timeouts for async operations
- All tests use reliable selectors discovered through MCP browser exploration









