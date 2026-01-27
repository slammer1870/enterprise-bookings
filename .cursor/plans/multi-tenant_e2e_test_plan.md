# Multi-Tenant MVP E2E Test Plan

## Overview

This document outlines all E2E test cases required to validate the MVP (Phase 1) of the multi-tenant atnd-me application. Tests are organized by feature area and cover subdomain routing, tenant isolation, access control, booking functionality, and admin panel operations.

## Test Infrastructure

### Test Setup Requirements

- **Test Database**: Isolated PostgreSQL database per test run
- **Test Tenants**: Create test tenants (`test-tenant-1`, `test-tenant-2`, `test-tenant-3`)
- **Test Users**: 
  - Super admin (`admin@test.com`)
  - Tenant-admin for tenant-1 (`tenant-admin-1@test.com`)
  - Tenant-admin for tenant-2 (`tenant-admin-2@test.com`)
  - Regular user registered in tenant-1 (`user1@test.com`)
  - Regular user registered in tenant-2 (`user2@test.com`)
  - Regular user with no tenant (`user3@test.com`)
- **Test Data**: Default data created via tenant onboarding hooks
- **Subdomain Simulation**: Use Playwright's `route` API or modify host headers to simulate subdomains

### Test Helpers

Create `apps/atnd-me/tests/e2e/helpers/`:
- `tenant-helpers.ts` - Helper functions for tenant operations
- `auth-helpers.ts` - Helper functions for authentication
- `data-helpers.ts` - Helper functions for creating test data
- `subdomain-helpers.ts` - Helper functions for subdomain simulation

## Test Files Structure

```
apps/atnd-me/tests/e2e/
├── tenant-routing.e2e.spec.ts          # Subdomain routing and tenant detection
├── marketing-landing.e2e.spec.ts       # Marketing landing page and tenants listing
├── tenant-isolation.e2e.spec.ts       # Tenant-scoped content isolation
├── cross-tenant-booking.e2e.spec.ts    # Cross-tenant booking capability
├── booking-functionality.e2e.spec.ts   # Booking CRUD operations
├── user-access-control.e2e.spec.ts    # User visibility and access control
├── tenant-admin-access.e2e.spec.ts    # Tenant-admin access restrictions
├── super-admin-access.e2e.spec.ts     # Super admin access to all tenants
├── tenant-onboarding.e2e.spec.ts      # Tenant creation and default data
├── admin-panel-access.e2e.spec.ts     # Admin panel access for different roles
└── helpers/
    ├── tenant-helpers.ts
    ├── auth-helpers.ts
    ├── data-helpers.ts
    └── subdomain-helpers.ts
```

---

## 1. Tenant Routing & Subdomain Detection

**File**: `tenant-routing.e2e.spec.ts`

### 1.1 Root Domain Routing

**Test**: `should show marketing landing page on root domain`
- Navigate to `http://localhost:3000` (no subdomain)
- Verify marketing landing page is displayed
- Verify no tenant-specific content is shown
- Verify link to `/tenants` page exists

**Test**: `should redirect root domain to marketing page when tenant context missing`
- Navigate to root domain
- Verify redirect to marketing page or marketing content is shown
- Verify tenant context is not set

### 1.2 Valid Subdomain Routing

**Test**: `should route to correct tenant when valid subdomain is used`
- Navigate to `http://test-tenant-1.localhost:3000`
- Verify tenant-1's home page is displayed
- Verify tenant context is correctly set
- Verify tenant-1's navbar and footer are shown

**Test**: `should display tenant-specific home page content`
- Navigate to `http://test-tenant-1.localhost:3000`
- Verify home page content matches tenant-1's default data
- Verify HeroScheduleBlock is displayed with tenant-1 branding
- Verify tenant-1's lessons are shown in schedule

**Test**: `should set tenant context in headers for API calls`
- Navigate to `http://test-tenant-1.localhost:3000`
- Intercept API calls and verify `x-tenant-id` header is set
- Verify Payload API calls include tenant context

### 1.3 Invalid Subdomain Handling

**Test**: `should handle invalid subdomain gracefully`
- Navigate to `http://invalid-tenant.localhost:3000`
- Verify error page or redirect to marketing page
- Verify no tenant context is set
- Verify user-friendly error message is displayed

**Test**: `should handle non-existent tenant subdomain`
- Create tenant with slug `test-tenant-1`
- Navigate to `http://non-existent.localhost:3000`
- Verify appropriate error handling (404 or redirect)

### 1.4 Subdomain Persistence

**Test**: `should maintain tenant context across page navigation`
- Navigate to `http://test-tenant-1.localhost:3000`
- Navigate to different pages within tenant-1
- Verify tenant context persists across all pages
- Verify all API calls maintain tenant context

**Test**: `should maintain tenant context in cookies`
- Navigate to `http://test-tenant-1.localhost:3000`
- Verify tenant ID is stored in cookies
- Verify cookie persists across page reloads

---

## 2. Marketing Landing Page & Tenants Listing

**File**: `marketing-landing.e2e.spec.ts`

### 2.1 Marketing Landing Page

**Test**: `should display marketing landing page on root domain`
- Navigate to `http://localhost:3000`
- Verify marketing content is displayed
- Verify no tenant-specific data is shown
- Verify call-to-action buttons are present

**Test**: `should link to tenants listing page`
- Navigate to `http://localhost:3000`
- Click link/button to tenants listing page
- Verify navigation to `/tenants` page
- Verify tenants listing page is displayed

**Test**: `should be accessible without authentication`
- Navigate to `http://localhost:3000` without login
- Verify page loads successfully
- Verify no authentication required

**Test**: `should not show tenant-specific content`
- Navigate to `http://localhost:3000`
- Verify no lessons, instructors, or bookings are shown
- Verify no tenant-specific navbar/footer

### 2.2 Tenants Listing Page

**Test**: `should display all tenants on listing page`
- Create 3 test tenants
- Navigate to `http://localhost:3000/tenants`
- Verify all 3 tenants are displayed
- Verify tenant names, descriptions, and logos are shown

**Test**: `should link to tenant subdomains`
- Navigate to `http://localhost:3000/tenants`
- Click on tenant-1 card/link
- Verify navigation to `http://test-tenant-1.localhost:3000`
- Verify tenant-1's home page is displayed

**Test**: `should be accessible without authentication`
- Navigate to `http://localhost:3000/tenants` without login
- Verify page loads successfully
- Verify all tenants are listed

**Test**: `should display tenant information correctly`
- Navigate to `http://localhost:3000/tenants`
- Verify tenant name is displayed
- Verify tenant description is displayed (if available)
- Verify tenant logo/image is displayed (if available)

**Test**: `should handle empty tenants list`
- Delete all tenants
- Navigate to `http://localhost:3000/tenants`
- Verify appropriate empty state message
- Verify no errors are thrown

---

## 3. Tenant Isolation & Content Scoping

**File**: `tenant-isolation.e2e.spec.ts`

### 3.1 Pages Collection Isolation

**Test**: `should show only tenant-1 pages on tenant-1 subdomain`
- Create page in tenant-1 with slug `about`
- Create page in tenant-2 with slug `about`
- Navigate to `http://test-tenant-1.localhost:3000/about`
- Verify tenant-1's about page is displayed
- Verify tenant-2's about page is NOT displayed

**Test**: `should show tenant-specific home page`
- Navigate to `http://test-tenant-1.localhost:3000`
- Verify tenant-1's home page content
- Navigate to `http://test-tenant-2.localhost:3000`
- Verify tenant-2's home page content (different from tenant-1)

**Test**: `should filter pages by tenant in API calls`
- Navigate to `http://test-tenant-1.localhost:3000`
- Intercept API calls to pages collection
- Verify `where` clause includes tenant filter
- Verify only tenant-1 pages are returned

### 3.2 Lessons Collection Isolation

**Test**: `should show only tenant-1 lessons on tenant-1 subdomain`
- Create lesson in tenant-1
- Create lesson in tenant-2
- Navigate to `http://test-tenant-1.localhost:3000`
- Verify only tenant-1's lessons appear in schedule
- Verify tenant-2's lessons do NOT appear

**Test**: `should filter lessons by tenant in tRPC queries`
- Navigate to `http://test-tenant-1.localhost:3000`
- Verify Schedule component shows only tenant-1 lessons
- Verify tRPC `lessons.getByDate` returns only tenant-1 lessons

**Test**: `should show correct lesson details for tenant`
- Create lesson in tenant-1 with specific details
- Navigate to `http://test-tenant-1.localhost:3000/bookings/{lessonId}`
- Verify lesson details match tenant-1's lesson
- Verify lesson is bookable

### 3.3 Instructors Collection Isolation

**Test**: `should show only tenant-1 instructors on tenant-1 subdomain`
- Create instructor in tenant-1
- Create instructor in tenant-2
- Navigate to `http://test-tenant-1.localhost:3000`
- Verify only tenant-1's instructors are shown
- Verify tenant-2's instructors are NOT shown

**Test**: `should filter instructors by tenant in API calls`
- Navigate to `http://test-tenant-1.localhost:3000`
- Intercept API calls to instructors collection
- Verify only tenant-1 instructors are returned

### 3.4 Class Options Collection Isolation

**Test**: `should show only tenant-1 class options on tenant-1 subdomain`
- Create class option in tenant-1
- Create class option in tenant-2
- Navigate to `http://test-tenant-1.localhost:3000`
- Verify only tenant-1's class options are available for booking
- Verify tenant-2's class options are NOT available

**Test**: `should filter class options by tenant in lesson creation`
- Navigate to admin panel for tenant-1
- Create new lesson
- Verify only tenant-1's class options appear in dropdown
- Verify tenant-2's class options do NOT appear

### 3.5 Navbar & Footer Isolation

**Test**: `should show tenant-1 navbar on tenant-1 subdomain`
- Create custom navbar for tenant-1
- Navigate to `http://test-tenant-1.localhost:3000`
- Verify tenant-1's navbar is displayed
- Verify navbar items match tenant-1's configuration

**Test**: `should show tenant-2 navbar on tenant-2 subdomain`
- Create custom navbar for tenant-2
- Navigate to `http://test-tenant-2.localhost:3000`
- Verify tenant-2's navbar is displayed (different from tenant-1)

**Test**: `should show tenant-1 footer on tenant-1 subdomain`
- Create custom footer for tenant-1
- Navigate to `http://test-tenant-1.localhost:3000`
- Verify tenant-1's footer is displayed
- Verify footer content matches tenant-1's configuration

**Test**: `should show tenant-2 footer on tenant-2 subdomain`
- Create custom footer for tenant-2
- Navigate to `http://test-tenant-2.localhost:3000`
- Verify tenant-2's footer is displayed (different from tenant-1)

### 3.6 Scheduler Isolation

**Test**: `should show tenant-1 scheduler configuration on tenant-1 subdomain`
- Configure scheduler for tenant-1
- Navigate to `http://test-tenant-1.localhost:3000`
- Verify scheduler uses tenant-1's configuration
- Verify scheduler displays tenant-1's lessons only

---

## 4. Cross-Tenant Booking Capability

**File**: `cross-tenant-booking.e2e.spec.ts`

### 4.1 User Registration Tenant Tracking

**Test**: `should track user registration tenant`
- Register new user on `http://test-tenant-1.localhost:3000`
- Verify user's `registrationTenant` is set to tenant-1
- Verify user can be seen by tenant-1 admin

**Test**: `should allow user to book across tenants`
- User registered in tenant-1
- Navigate to `http://test-tenant-2.localhost:3000`
- Verify user can view tenant-2's lessons
- Verify user can create booking in tenant-2

### 4.2 Cross-Tenant Booking Creation

**Test**: `should allow user from tenant-1 to book lesson in tenant-2`
- User registered in tenant-1
- Create lesson in tenant-2
- Navigate to `http://test-tenant-2.localhost:3000/bookings/{lessonId}`
- Login as user from tenant-1
- Create booking for tenant-2's lesson
- Verify booking is created successfully
- Verify booking's tenant is set to tenant-2 (lesson's tenant)

**Test**: `should set booking tenant to lesson's tenant, not user's registration tenant`
- User registered in tenant-1
- Create lesson in tenant-2
- Create booking for tenant-2's lesson
- Verify booking's tenant field is set to tenant-2
- Verify booking's tenant is NOT set to tenant-1

**Test**: `should allow user to have bookings in multiple tenants`
- User registered in tenant-1
- Create booking in tenant-1
- Create booking in tenant-2
- Verify user has bookings in both tenants
- Verify bookings are correctly scoped to their respective tenants

### 4.3 Cross-Tenant Booking Visibility

**Test**: `should show user's bookings from all tenants in user's booking list`
- User registered in tenant-1
- Create booking in tenant-1
- Create booking in tenant-2
- Navigate to user's bookings page
- Verify bookings from both tenants are displayed

**Test**: `should filter bookings by tenant in admin panel`
- Tenant-admin for tenant-1 logs into admin panel
- Verify only tenant-1's bookings are shown
- Verify tenant-2's bookings are NOT shown

**Test**: `should show all bookings to super admin`
- Super admin logs into admin panel
- Verify bookings from all tenants are shown
- Verify tenant filter or tenant column is displayed

---

## 5. Booking Functionality (MVP - No Payment Validation)

**File**: `booking-functionality.e2e.spec.ts`

### 5.1 Booking Creation

**Test**: `should create booking without payment validation (MVP)`
- Navigate to `http://test-tenant-1.localhost:3000/bookings/{lessonId}`
- Login as regular user
- Select quantity and submit booking
- Verify booking is created successfully
- Verify no payment validation is performed (MVP)

**Test**: `should create booking with correct status (pending)`
- Create booking for lesson
- Verify booking status is set to `pending` by default
- Verify booking is visible in user's bookings

**Test**: `should validate booking quantity against lesson capacity`
- Create lesson with capacity of 10
- Create 8 existing bookings
- Attempt to book 3 slots
- Verify error message or validation prevents over-booking
- Verify only 2 slots can be booked

**Test**: `should prevent booking past lockOutTime`
- Create lesson with `lockOutTime: 30` minutes
- Set lesson start time to 20 minutes from now
- Attempt to create booking
- Verify booking is prevented or error is shown

**Test**: `should allow booking active lessons only`
- Create inactive lesson
- Attempt to create booking
- Verify booking is prevented or error is shown

### 5.2 Booking Viewing

**Test**: `should display user's bookings`
- User creates multiple bookings
- Navigate to bookings management page
- Verify all user's bookings are displayed
- Verify booking details are correct (lesson, date, quantity, status)

**Test**: `should display booking status correctly`
- Create bookings with different statuses (pending, confirmed, cancelled, waiting)
- Navigate to bookings page
- Verify each booking's status is displayed correctly

**Test**: `should show booking details for specific booking`
- Create booking
- Navigate to booking detail page
- Verify all booking information is displayed
- Verify lesson details are shown

### 5.3 Booking Cancellation

**Test**: `should cancel booking when user clicks cancel`
- Create booking
- Navigate to booking management page
- Click cancel button
- Confirm cancellation
- Verify booking status is updated to `cancelled`
- Verify booking is removed from active bookings list

**Test**: `should allow cancelling individual booking from multiple bookings`
- User has multiple bookings for same lesson
- Navigate to manage bookings page
- Cancel one booking
- Verify only that booking is cancelled
- Verify other bookings remain active

**Test**: `should prevent cancelling booking past cancellation deadline`
- Create lesson with cancellation deadline
- Attempt to cancel booking after deadline
- Verify cancellation is prevented or error is shown

### 5.4 Booking Status Management

**Test**: `should update booking status to confirmed`
- Create booking with status `pending`
- Admin updates status to `confirmed`
- Verify booking status is updated
- Verify user sees confirmed status

**Test**: `should update booking status to waiting`
- Create booking when lesson is full
- Verify booking status is set to `waiting`
- Verify user sees waiting status

**Test**: `should update booking status to cancelled`
- Create booking
- Admin or user cancels booking
- Verify booking status is set to `cancelled`
- Verify booking is no longer counted in lesson capacity

### 5.5 Booking Quantity Management

**Test**: `should allow increasing booking quantity`
- User has booking with quantity 1
- Navigate to manage bookings page
- Increase quantity to 2
- Verify booking quantity is updated
- Verify lesson capacity is updated correctly

**Test**: `should allow decreasing booking quantity`
- User has booking with quantity 3
- Navigate to manage bookings page
- Decrease quantity to 2
- Verify booking quantity is updated
- Verify one booking is cancelled (if quantity reaches 0)

**Test**: `should prevent increasing quantity beyond remaining capacity`
- Lesson has capacity of 10, 8 bookings exist
- User has booking with quantity 1
- Attempt to increase to 4
- Verify increase is prevented or limited to 2
- Verify error message is shown

---

## 6. User Access Control & Visibility

**File**: `user-access-control.e2e.spec.ts`

### 6.1 User Visibility Rules

**Test**: `should show user to tenant-1 admin if user registered in tenant-1`
- Register user on `http://test-tenant-1.localhost:3000`
- Login as tenant-1 admin
- Navigate to users collection in admin panel
- Verify user is visible in tenant-1's user list

**Test**: `should show user to tenant-1 admin if user has booking in tenant-1`
- User registered in tenant-2
- User creates booking in tenant-1
- Login as tenant-1 admin
- Navigate to users collection
- Verify user is visible in tenant-1's user list

**Test**: `should NOT show user to tenant-2 admin if user only registered/booked in tenant-1`
- User registered in tenant-1, no bookings in tenant-2
- Login as tenant-2 admin
- Navigate to users collection
- Verify user is NOT visible in tenant-2's user list

**Test**: `should show all users to super admin`
- Create users in multiple tenants
- Login as super admin
- Navigate to users collection
- Verify all users from all tenants are visible

### 6.2 User Access Permissions

**Test**: `should allow super admin to update any user`
- Login as super admin
- Navigate to user from tenant-1
- Update user details
- Verify update is successful

**Test**: `should allow tenant-admin to update users in their tenant`
- Login as tenant-1 admin
- Navigate to user registered in tenant-1
- Update user details
- Verify update is successful

**Test**: `should prevent tenant-admin from updating users in other tenants`
- Login as tenant-1 admin
- Attempt to navigate to user registered in tenant-2
- Verify access is denied or user is not visible

**Test**: `should allow users to update themselves`
- Login as regular user
- Navigate to own profile
- Update own details
- Verify update is successful

**Test**: `should prevent users from updating other users`
- Login as regular user
- Attempt to update another user's profile
- Verify access is denied

**Test**: `should allow only super admin to delete users`
- Login as tenant-admin
- Attempt to delete user
- Verify delete action is not available or access is denied
- Login as super admin
- Verify delete action is available

---

## 7. Tenant-Admin Access Control

**File**: `tenant-admin-access.e2e.spec.ts`

### 7.1 Tenant-Admin Access to Own Tenant

**Test**: `should allow tenant-admin to access admin panel`
- Login as tenant-1 admin
- Navigate to `/admin`
- Verify admin panel is accessible
- Verify tenant-admin can see admin interface

**Test**: `should show only tenant-1 data to tenant-1 admin`
- Login as tenant-1 admin
- Navigate to pages collection
- Verify only tenant-1's pages are shown
- Navigate to lessons collection
- Verify only tenant-1's lessons are shown
- Navigate to instructors collection
- Verify only tenant-1's instructors are shown

**Test**: `should allow tenant-admin to create content in their tenant`
- Login as tenant-1 admin
- Create new page in pages collection
- Verify page is created
- Verify page is automatically assigned to tenant-1
- Verify page is visible on tenant-1's frontend

**Test**: `should allow tenant-admin to update content in their tenant`
- Login as tenant-1 admin
- Update existing page in tenant-1
- Verify update is successful
- Verify changes are reflected on frontend

**Test**: `should allow tenant-admin to delete content in their tenant`
- Login as tenant-1 admin
- Delete page from tenant-1
- Verify deletion is successful
- Verify page is removed from frontend

### 7.2 Tenant-Admin Access Restrictions

**Test**: `should prevent tenant-admin from accessing other tenants' data`
- Login as tenant-1 admin
- Attempt to navigate to tenant-2's pages
- Verify tenant-2's pages are NOT visible
- Attempt to access tenant-2's lessons
- Verify tenant-2's lessons are NOT visible

**Test**: `should prevent tenant-admin from creating content in other tenants`
- Login as tenant-1 admin
- Attempt to create page and assign to tenant-2
- Verify assignment to tenant-2 is prevented or not possible
- Verify page is created in tenant-1 only

**Test**: `should prevent tenant-admin from updating other tenants' data`
- Login as tenant-1 admin
- Attempt to update tenant-2's page (if somehow accessible)
- Verify update is prevented or access is denied

**Test**: `should prevent tenant-admin from deleting other tenants' data`
- Login as tenant-1 admin
- Attempt to delete tenant-2's page (if somehow accessible)
- Verify deletion is prevented or access is denied

**Test**: `should prevent tenant-admin from accessing tenants collection`
- Login as tenant-1 admin
- Navigate to admin panel
- Verify tenants collection is NOT visible or accessible
- Verify tenant-admin cannot create/update/delete tenants

**Test**: `should prevent tenant-admin from accessing other tenant admins`
- Login as tenant-1 admin
- Navigate to users collection
- Verify tenant-2 admin is NOT visible
- Verify tenant-admin can only see users in their tenant

### 7.3 Tenant-Admin User Management

**Test**: `should allow tenant-admin to create users in their tenant`
- Login as tenant-1 admin
- Create new user in users collection
- Verify user is created
- Verify user's `registrationTenant` is set to tenant-1
- Verify user is visible in tenant-1's user list

**Test**: `should allow tenant-admin to update users in their tenant`
- Login as tenant-1 admin
- Update user registered in tenant-1
- Verify update is successful

**Test**: `should prevent tenant-admin from creating users in other tenants`
- Login as tenant-1 admin
- Attempt to create user and assign to tenant-2
- Verify assignment to tenant-2 is prevented
- Verify user is created in tenant-1 only

---

## 8. Super Admin Access Control

**File**: `super-admin-access.e2e.spec.ts`

### 8.1 Super Admin Access to All Tenants

**Test**: `should allow super admin to access all tenants' data`
- Login as super admin
- Navigate to pages collection
- Verify pages from all tenants are visible
- Verify tenant filter or tenant column is displayed

**Test**: `should allow super admin to create content in any tenant`
- Login as super admin
- Create new page and assign to tenant-1
- Verify page is created in tenant-1
- Create new page and assign to tenant-2
- Verify page is created in tenant-2

**Test**: `should allow super admin to update content in any tenant`
- Login as super admin
- Update page in tenant-1
- Verify update is successful
- Update page in tenant-2
- Verify update is successful

**Test**: `should allow super admin to delete content in any tenant`
- Login as super admin
- Delete page from tenant-1
- Verify deletion is successful
- Delete page from tenant-2
- Verify deletion is successful

### 8.2 Super Admin Tenant Management

**Test**: `should allow super admin to access tenants collection`
- Login as super admin
- Navigate to tenants collection
- Verify tenants collection is visible and accessible
- Verify all tenants are listed

**Test**: `should allow super admin to create new tenant`
- Login as super admin
- Create new tenant with name, slug, and domain
- Verify tenant is created
- Verify default data is created (home page, class options, lessons, navbar, footer)
- Verify tenant is accessible via subdomain

**Test**: `should allow super admin to update tenant`
- Login as super admin
- Update tenant details (name, slug, domain)
- Verify update is successful
- Verify changes are reflected

**Test**: `should allow super admin to delete tenant`
- Login as super admin
- Delete tenant
- Verify tenant is deleted
- Verify tenant's data is handled appropriately (cascade delete or orphan handling)

### 8.3 Super Admin User Management

**Test**: `should allow super admin to see all users from all tenants`
- Login as super admin
- Navigate to users collection
- Verify users from all tenants are visible
- Verify tenant filter or tenant column is displayed

**Test**: `should allow super admin to update any user`
- Login as super admin
- Update user from tenant-1
- Verify update is successful
- Update user from tenant-2
- Verify update is successful

**Test**: `should allow super admin to delete any user`
- Login as super admin
- Delete user from any tenant
- Verify deletion is successful

**Test**: `should allow super admin to assign tenant-admin role`
- Login as super admin
- Update user to assign `tenant-admin` role
- Assign user to specific tenant
- Verify role assignment is successful
- Verify user can access admin panel for their tenant

---

## 9. Tenant Onboarding & Default Data

**File**: `tenant-onboarding.e2e.spec.ts`

### 9.1 Tenant Creation

**Test**: `should create tenant with required fields`
- Login as super admin
- Create new tenant with name and slug
- Verify tenant is created successfully
- Verify tenant slug is unique

**Test**: `should prevent duplicate tenant slugs`
- Create tenant with slug `test-tenant-1`
- Attempt to create another tenant with same slug
- Verify creation is prevented
- Verify error message is displayed

**Test**: `should allow optional domain field`
- Create tenant with name, slug, and optional domain
- Verify tenant is created successfully
- Verify domain is stored correctly

### 9.2 Default Data Creation

**Test**: `should create default home page when tenant is created`
- Create new tenant
- Verify default home page is created with slug `home`
- Verify home page contains HeroScheduleBlock
- Verify home page title includes tenant name
- Navigate to tenant subdomain
- Verify home page is displayed

**Test**: `should create default class options when tenant is created`
- Create new tenant
- Verify 2-3 default class options are created
- Verify class options have names, places, and descriptions
- Verify class options are scoped to the tenant

**Test**: `should create default lessons when tenant is created`
- Create new tenant
- Verify 2-3 default lessons are created
- Verify lessons are upcoming (future dates)
- Verify lessons use default class options
- Verify lessons are active
- Verify lessons have default lockOutTime

**Test**: `should create default navbar when tenant is created`
- Create new tenant
- Verify default navbar is created
- Verify navbar contains basic navigation items (Home, Bookings)
- Navigate to tenant subdomain
- Verify navbar is displayed on frontend

**Test**: `should create default footer when tenant is created`
- Create new tenant
- Verify default footer is created
- Verify footer contains copyright text with tenant name
- Navigate to tenant subdomain
- Verify footer is displayed on frontend

**Test**: `should scope all default data to the tenant`
- Create new tenant
- Verify all default data (pages, lessons, class options, navbar, footer) has tenant field set
- Verify default data is only visible on tenant's subdomain
- Verify default data is NOT visible on other tenants' subdomains

### 9.3 Default Data Customization

**Test**: `should allow tenant-admin to customize default home page`
- Create new tenant
- Login as tenant-admin
- Update default home page
- Verify changes are saved
- Verify changes are reflected on frontend

**Test**: `should allow tenant-admin to delete default data`
- Create new tenant
- Login as tenant-admin
- Delete default class option
- Verify deletion is successful
- Verify class option is removed from frontend

**Test**: `should allow tenant-admin to add additional content`
- Create new tenant
- Login as tenant-admin
- Create additional pages, lessons, class options
- Verify new content is created
- Verify new content is scoped to tenant

---

## 10. Admin Panel Access & Navigation

**File**: `admin-panel-access.e2e.spec.ts`

### 10.1 Role-Based Admin Panel Access

**Test**: `should allow super admin to access admin panel`
- Login as super admin
- Navigate to `/admin`
- Verify admin panel loads successfully
- Verify all collections are accessible

**Test**: `should allow tenant-admin to access admin panel`
- Login as tenant-1 admin
- Navigate to `/admin`
- Verify admin panel loads successfully
- Verify tenant-scoped collections are accessible

**Test**: `should prevent regular user from accessing admin panel`
- Login as regular user
- Navigate to `/admin`
- Verify access is denied or redirect to frontend
- Verify admin panel is not accessible

### 10.2 Collection Visibility in Admin Panel

**Test**: `should show all collections to super admin`
- Login as super admin
- Navigate to admin panel
- Verify tenants collection is visible
- Verify all tenant-scoped collections are visible
- Verify users collection is visible

**Test**: `should show only tenant-scoped collections to tenant-admin`
- Login as tenant-1 admin
- Navigate to admin panel
- Verify tenants collection is NOT visible
- Verify tenant-scoped collections are visible (pages, lessons, instructors, class-options, bookings, navbar, footer, scheduler)
- Verify users collection is visible (filtered to tenant-1)

**Test**: `should hide tenants collection from tenant-admin`
- Login as tenant-1 admin
- Navigate to admin panel
- Verify tenants collection is not in navigation
- Verify direct URL to tenants collection is blocked

### 10.3 Admin Panel Navigation

**Test**: `should allow super admin to navigate between tenants in admin panel`
- Login as super admin
- Navigate to pages collection
- Verify tenant filter or tenant selector is available
- Switch between tenants
- Verify data updates to show selected tenant's content

**Test**: `should show tenant context in admin panel for tenant-admin`
- Login as tenant-1 admin
- Navigate to admin panel
- Verify tenant context is displayed (e.g., "Managing: Tenant 1")
- Verify all operations are scoped to tenant-1

**Test**: `should prevent tenant-admin from switching tenants`
- Login as tenant-1 admin
- Navigate to admin panel
- Verify no tenant selector is available
- Verify all operations are locked to tenant-1

---

## 11. Integration & Edge Cases

**File**: `integration-edge-cases.e2e.spec.ts`

### 11.1 Multi-Tenant Data Integrity

**Test**: `should maintain data isolation when multiple tenants exist`
- Create 3 tenants with similar content (pages with same slug, lessons with same dates)
- Navigate to each tenant's subdomain
- Verify each tenant sees only their own content
- Verify no data leakage between tenants

**Test**: `should handle tenant deletion gracefully`
- Create tenant with content and bookings
- Delete tenant
- Verify tenant is deleted
- Verify tenant's bookings are handled (cascade delete or orphan handling)
- Verify other tenants' data is unaffected

### 11.2 Authentication & Session Management

**Test**: `should maintain user session across tenant subdomains`
- Login on `http://test-tenant-1.localhost:3000`
- Navigate to `http://test-tenant-2.localhost:3000`
- Verify user remains logged in
- Verify user can access both tenants' content

**Test**: `should handle authentication on root domain`
- Login on root domain (`http://localhost:3000`)
- Verify authentication works
- Navigate to tenant subdomain
- Verify user remains authenticated

### 11.3 API & tRPC Integration

**Test**: `should pass tenant context to tRPC queries`
- Navigate to `http://test-tenant-1.localhost:3000`
- Verify Schedule component loads
- Intercept tRPC `lessons.getByDate` query
- Verify tenant context is included in request
- Verify only tenant-1's lessons are returned

**Test**: `should pass tenant context to Payload API calls`
- Navigate to `http://test-tenant-1.localhost:3000`
- Intercept Payload API calls
- Verify `x-tenant-id` header is set
- Verify API responses are filtered by tenant

### 11.4 Error Handling

**Test**: `should handle missing tenant gracefully`
- Navigate to subdomain for non-existent tenant
- Verify appropriate error page or redirect
- Verify user-friendly error message

**Test**: `should handle tenant context errors gracefully`
- Simulate missing tenant context in API call
- Verify error is handled gracefully
- Verify user sees appropriate error message

**Test**: `should handle invalid tenant ID in headers`
- Set invalid tenant ID in request headers
- Verify error is handled gracefully
- Verify system falls back to safe state

---

## Test Execution Strategy

### Test Data Setup

1. **Before All Tests**: Create test database and seed test tenants
2. **Before Each Test Suite**: Create test users and test data
3. **After Each Test**: Clean up test-specific data (optional, can use isolated test database)
4. **After All Tests**: Clean up test database

### Test Execution Order

1. **Infrastructure Tests**: Tenant routing, subdomain detection
2. **Public Access Tests**: Marketing landing, tenants listing
3. **Isolation Tests**: Tenant-scoped content isolation
4. **User Flow Tests**: Cross-tenant booking, booking functionality
5. **Access Control Tests**: User access, tenant-admin access, super admin access
6. **Admin Panel Tests**: Admin panel access and navigation
7. **Integration Tests**: Multi-tenant data integrity, edge cases

### Test Helpers Implementation

**Subdomain Simulation**:
- Use Playwright's `route` API to modify host headers
- Or use environment variable to set base URL with subdomain
- Or use Playwright's `context.route()` to intercept and modify requests

**Authentication Helpers**:
- `loginAsUser(email, password)` - Login as specific user
- `loginAsTenantAdmin(tenantSlug)` - Login as tenant-admin for specific tenant
- `loginAsSuperAdmin()` - Login as super admin

**Tenant Helpers**:
- `navigateToTenant(tenantSlug)` - Navigate to tenant subdomain
- `getTenantContext()` - Get current tenant context from page
- `createTestTenant(name, slug)` - Create test tenant via API

**Data Helpers**:
- `createTestLesson(tenantId, data)` - Create test lesson in tenant
- `createTestBooking(userId, lessonId, quantity)` - Create test booking
- `cleanupTestData()` - Clean up test data

---

## Test Coverage Summary

### MVP Features Covered

✅ Subdomain-based tenant identification
✅ Tenant-scoped collections (pages, lessons, instructors, class-options, scheduler, navbar, footer)
✅ Role structure (admin, tenant-admin, user)
✅ User access control with cross-tenant booking capability
✅ Marketing landing page and tenants listing page
✅ Basic booking functionality (create, view, cancel)
✅ Booking status management (pending, confirmed, cancelled, waiting)
✅ Tenant onboarding and default data creation
✅ Admin panel access for different roles
✅ Tenant isolation and data integrity

### Excluded from MVP (Phase 2)

❌ Payment method validation
❌ Subscription/membership validation
❌ Stripe integration
❌ Payment processing flows

---

## Notes

- All tests should use isolated test data to avoid conflicts
- Tests should be idempotent (can run multiple times safely)
- Use Playwright's `test.describe` and `test.beforeEach` for proper test organization
- Consider using Playwright's `test.step` for complex test scenarios
- All API calls should be intercepted to verify tenant context
- Tests should verify both frontend display and backend API behavior
- Consider adding visual regression tests for tenant-specific UI (navbar, footer)
