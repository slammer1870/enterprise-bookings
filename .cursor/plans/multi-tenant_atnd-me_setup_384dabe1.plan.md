---
name: Multi-tenant atnd-me setup (MVP)
overview: Convert atnd-me app to multi-tenant architecture using Payload's multi-tenant plugin. MVP includes tenant-scoped collections (pages, lessons, instructors, class-options, scheduler, navbar, footer, users) and custom user access control allowing cross-tenant bookings. Payment functionality will be added in Phase 2.
todos:
  - id: setup-test-infrastructure
    content: Create test utilities and helpers for multi-tenant testing
    status: pending
  - id: write-plugin-tests
    content: Write integration tests for multi-tenant plugin configuration
    status: pending
    dependencies:
      - setup-test-infrastructure
  - id: install-plugin
    content: Install @payloadcms/plugin-multi-tenant package
    status: pending
    dependencies:
      - write-plugin-tests
  - id: write-tenants-collection-tests
    content: Write integration tests for Tenants collection (creation, access control)
    status: pending
    dependencies:
      - setup-test-infrastructure
  - id: create-tenants-collection
    content: Create Tenants collection with name, slug, and domain fields, including onboarding hook
    status: pending
    dependencies:
      - write-tenants-collection-tests
  - id: write-tenant-onboarding-tests
    content: Write integration tests for tenant onboarding (default data creation)
    status: pending
    dependencies:
      - setup-test-infrastructure
  - id: implement-tenant-onboarding
    content: Create hook to automatically create default data (home page, class options, lessons, navbar, footer) when tenant is created
    status: pending
    dependencies:
      - write-tenant-onboarding-tests
      - create-tenants-collection
      - convert-header-to-collection
      - convert-footer-to-collection
  - id: convert-header-to-collection
    content: "Convert Header global to Navbar collection with isGlobal: true"
    status: pending
    dependencies:
      - create-tenants-collection
  - id: convert-footer-to-collection
    content: "Convert Footer global to Footer collection with isGlobal: true"
    status: pending
    dependencies:
      - create-tenants-collection
  - id: convert-scheduler-to-collection
    content: "Convert scheduler global to Scheduler collection with isGlobal: true"
    status: pending
    dependencies:
      - create-tenants-collection
  - id: configure-multi-tenant-plugin
    content: Add multi-tenant plugin to plugins array with all collections configured
    status: pending
    dependencies:
      - install-plugin
      - create-tenants-collection
      - convert-header-to-collection
      - convert-footer-to-collection
      - convert-scheduler-to-collection
  - id: write-roles-tests
    content: Write integration tests for role configuration (admin, tenant-admin, user)
    status: pending
    dependencies:
      - setup-test-infrastructure
  - id: update-roles-config
    content: Update roles plugin and better auth options to include admin, tenant-admin, and user roles
    status: pending
    dependencies:
      - write-roles-tests
      - configure-multi-tenant-plugin
  - id: update-package-access-controls
    content: Override bookings plugin access controls in atnd-me to support tenant-admin role
    status: pending
    dependencies:
      - update-roles-config
  - id: write-booking-access-tests
    content: Write integration tests for booking access control (MVP - no payment validation, cross-tenant bookings)
    status: pending
    dependencies:
      - setup-test-infrastructure
      - write-user-access-tests
  - id: implement-booking-access-controls
    content: Create custom booking access controls for MVP (tenant-admin support, no payment validation)
    status: pending
    dependencies:
      - write-booking-access-tests
      - configure-multi-tenant-plugin
      - update-package-access-controls
  - id: add-user-tenant-fields
    content: Add registrationTenant and tenant fields to Users collection with validation for tenant-admin
    status: pending
    dependencies:
      - update-roles-config
  - id: write-user-access-tests
    content: Write integration tests for user access control (super admin, tenant-admin, cross-tenant visibility)
    status: pending
    dependencies:
      - setup-test-infrastructure
      - write-roles-tests
  - id: implement-user-access-control
    content: Create custom access control for users collection with super admin, tenant-admin, and user permissions
    status: pending
    dependencies:
      - write-user-access-tests
      - add-user-tenant-fields
  - id: implement-tenant-access-control
    content: Create access control functions for all tenant-scoped collections (pages, lessons, etc.)
    status: pending
    dependencies:
      - implement-user-access-control
  - id: write-middleware-tests
    content: Write unit tests for middleware tenant detection and context setting
    status: pending
    dependencies:
      - setup-test-infrastructure
  - id: create-middleware
    content: Create Next.js middleware to detect subdomain and set tenant context
    status: pending
    dependencies:
      - write-middleware-tests
      - configure-multi-tenant-plugin
  - id: write-frontend-routing-tests
    content: Write E2E tests for subdomain routing, marketing landing page, and tenants listing page
    status: pending
    dependencies:
      - setup-test-infrastructure
  - id: create-marketing-landing-page
    content: Create marketing landing page at root route with link to tenants page
    status: pending
    dependencies:
      - write-frontend-routing-tests
      - create-middleware
  - id: create-tenants-listing-page
    content: Create /tenants page that lists all tenants with links to their subdomains
    status: pending
    dependencies:
      - create-marketing-landing-page
      - create-tenants-collection
  - id: update-payload-config
    content: Update payload.config.ts to remove globals and add new collections
    status: pending
    dependencies:
      - convert-header-to-collection
      - convert-footer-to-collection
      - convert-scheduler-to-collection
  - id: create-migration
    content: Create database migration to add tenant fields and migrate existing data
    status: pending
    dependencies:
      - configure-multi-tenant-plugin
  - id: update-seed-script
    content: Update seed script to create default tenant and assign existing data
    status: pending
    dependencies:
      - create-tenants-collection
      - create-migration
---

# Multi-Tenant Setup for atnd-me App

## Overview

Transform the atnd-me app into a multi-tenant application using `@payloadcms/plugin-multi-tenant`. Each tenant will have isolated instances of pages, lessons, instructors, class-options, scheduler, navbar, footer, and users, with subdomain-based tenant identification.

## MVP Scope

### Included in MVP (Phase 1)

**Core Multi-Tenant Features:**

- Tenant collection and management
- Subdomain-based tenant identification
- Tenant-scoped collections (pages, lessons, instructors, class-options, scheduler, navbar, footer)
- Role structure (admin, tenant-admin, user)
- User access control with cross-tenant booking capability
- Marketing landing page and tenants listing page
- Basic booking functionality (create, view, cancel)
- Booking status management (pending, confirmed, cancelled, waiting)

**Current atnd-me Functionality:**

- Pages collection with layout builder
- Posts collection
- Media collection
- Categories collection
- Lessons collection
- Instructors collection
- Class Options collection
- Bookings collection (without payment validation)
- Scheduler global (converted to collection)
- Header/Footer globals (converted to collections)

### Excluded from MVP (Phase 2 - Future)

**Payment Functionality:**

- Payment method validation for bookings
- Subscription/membership validation
- Stripe integration for bookings
- Payment processing flows
- Drop-in payment methods
- Membership plans and subscriptions

**Why Excluded:**

- Current atnd-me app doesn't have paymentsPlugin or membershipsPlugin enabled
- Simplifies MVP implementation
- Can be added later without major refactoring
- Architecture will support adding payments in Phase 2

### Architecture for Future Payments

The MVP will be structured to easily add payment functionality later:

- Booking access controls will be extensible
- Tenant-aware payment validation helpers can be added
- No breaking changes needed when adding payments

## Code Organization: App vs Packages

### Architecture Principles

**Packages (`packages/`)** - Reusable code shared across multiple apps:

- Generic multi-tenant utilities and helpers
- Reusable access control patterns
- Tenant-aware business logic
- Shared types and interfaces

**App (`apps/atnd-me/`)** - App-specific code:

- Collection configurations specific to atnd-me
- Plugin configuration and overrides
- App-specific access control implementations
- Frontend routes and components
- App-specific business rules

### Code Distribution Strategy

#### In Packages (Reusable)

**New Package: `packages/multi-tenant-utils/`** (Optional - if reusable patterns emerge)

- `getTenantFromRequest()` - Extract tenant from request context
- `setTenantContext()` - Set tenant context in requests
- `validateTenantAccess()` - Generic tenant access validation
- Tenant context types and interfaces

**Extend Existing: `packages/shared-services/`**

- `access/is-admin-or-tenant-admin.ts` - Reusable access control for admin/tenant-admin
- `access/tenant-scoped-access.ts` - Generic tenant-scoped access patterns
- `tenant/getTenantFromLesson.ts` - Extract tenant from lesson (if reusable pattern)

**Extend Existing: `packages/shared-utils/`**

- `check-admin-role.ts` - Helper to check admin or tenant-admin roles
- Tenant-related type guards and utilities

#### In App (`apps/atnd-me/`)

**Collections** - App-specific:

- `src/collections/Tenants/` - Tenant collection config (app-specific fields)
- `src/collections/Navbar/` - Navbar collection (converted from global)
- `src/collections/Footer/` - Footer collection (converted from global)
- `src/collections/Scheduler/` - Scheduler collection (converted from global)
- `src/collections/Users/` - User collection with tenant fields (app-specific)

**Access Control** - App-specific implementations:

- `src/access/userTenantAccess.ts` - User visibility rules specific to atnd-me
- `src/access/tenantAccess.ts` - Collection-level access for atnd-me collections
- `src/access/bookingAccess.ts` - Booking access with atnd-me-specific payment validation

**Configuration** - App-specific:

- `src/plugins/index.ts` - Plugin configuration with atnd-me overrides
- `src/payload.config.ts` - Payload config with atnd-me collections
- `src/lib/auth/options.ts` - Better auth config for atnd-me

**Frontend** - App-specific:

- `src/middleware.ts` - Next.js middleware for atnd-me subdomain routing
- `src/app/(frontend)/**` - Frontend routes and components
- `src/utilities/getTenantContext.ts` - App-specific tenant context extraction
- `src/utilities/getTenantFromLesson.ts` - App-specific tenant extraction logic

**Tests** - App-specific:

- All test files in `tests/` directory

### Decision Matrix

| Code Type | Location | Reason |

|-----------|----------|--------|

| Generic tenant utilities | `packages/multi-tenant-utils/` or `shared-services` | Reusable across apps |

| Tenant access patterns | `packages/shared-services/access/` | Reusable access control |

| Role checking helpers | `packages/shared-utils/` | Already used by all apps |

| Collection configs | `apps/atnd-me/src/collections/` | App-specific schema |

| App-specific access control | `apps/atnd-me/src/access/` | App-specific business rules |

| Plugin configuration | `apps/atnd-me/src/plugins/` | App-specific plugin setup |

| Frontend routes | `apps/atnd-me/src/app/` | App-specific UI |

| Middleware | `apps/atnd-me/src/middleware.ts` | App-specific routing |

| Tests | `apps/atnd-me/tests/` | App-specific tests |

### When to Create New Package vs Extend Existing

**Create New Package (`packages/multi-tenant-utils/`)** if:

- Multiple apps will use multi-tenant features
- Generic utilities that don't fit existing packages
- Clear separation of concerns needed

**Extend Existing Package** if:

- Fits naturally into existing package purpose
- Only one or two apps need it initially
- Can be added incrementally

**Keep in App** if:

- Highly specific to atnd-me business logic
- Unlikely to be reused
- Tightly coupled to app configuration

## Test-Driven Development Approach

This implementation will follow **Test-Driven Development (TDD)** principles:

1. **Write tests first** - Define expected behavior through tests before implementation
2. **Run tests** - Verify tests fail (Red phase)
3. **Implement feature** - Write minimal code to make tests pass (Green phase)
4. **Refactor** - Improve code while keeping tests passing (Refactor phase)

### Testing Strategy

**Test Types:**

- **Unit Tests**: Utilities, helpers, access control functions
- **Integration Tests**: Collections, plugins, tenant context, payment validation
- **E2E Tests**: User flows, subdomain routing, cross-tenant bookings

**Test Structure:**

- `tests/unit/` - Unit tests for utilities and helpers
- `tests/int/` - Integration tests for Payload collections and plugins
- `tests/e2e/` - End-to-end tests for user flows

**Testing Tools:**

- **Vitest** - Unit and integration tests
- **Playwright** - E2E tests
- **Test Database** - Isolated PostgreSQL database per test run

## Architecture

### Tenant Identification

- **Method**: Subdomain-based (e.g., `tenant1.atnd-me.com`)
- **Implementation**: Next.js middleware will detect subdomain and set tenant context
- **Tenant Collection**: Create a `tenants` collection with fields: `name`, `slug`, `domain`

### Role Structure

- **`admin`** (Super Admin): Can access all tenants and all data across the entire system
- **`tenant-admin`**: Can only access their assigned tenant's data (pages, lessons, instructors, bookings, etc.)
- **`user`**: Regular users who can book classes across any tenant

### User Scoping Model

- Users can book into **any tenant** (cross-tenant capability)
- Each tenant can only see users who:

  1. Registered through their domain, OR
  2. Made a booking through their version of the app

- **Super admins** (`admin` role) can access all tenants and all users
- **Tenant admins** (`tenant-admin` role) can only access their assigned tenant's data

## Implementation Steps

### 0. Test-Driven Development Setup

Before implementing features, set up test infrastructure:

#### 0.1 Create Test Utilities

Create `apps/atnd-me/tests/helpers/tenant-test-helpers.ts`:

- `createTestTenant()` - Helper to create test tenant
- `createTestUserWithTenant()` - Helper to create user with tenant assignment
- `setTenantContext()` - Helper to set tenant context in requests
- `getTenantFromSubdomain()` - Helper to extract tenant from subdomain

#### 0.2 Create Test Config

Create `apps/atnd-me/tests/int/multi-tenant.config.ts`:

- Payload config with multi-tenant plugin enabled
- Test database setup
- Test tenant creation

### 1. Install Multi-Tenant Plugin

**TDD Step 1: Write Tests First**

Create `apps/atnd-me/tests/int/multi-tenant-plugin.int.spec.ts`:

- Test that multi-tenant plugin is configured correctly
- Test that tenant collection exists
- Test that tenant field is added to collections
- Test that queries are filtered by tenant

**TDD Step 2: Implement**

Add `@payloadcms/plugin-multi-tenant` to `apps/atnd-me/package.json`

Add `@payloadcms/plugin-multi-tenant` to `apps/atnd-me/package.json`:

```json
{
  "dependencies": {
    "@payloadcms/plugin-multi-tenant": "^1.0.0"
  }
}
```

### 2. Create Tenants Collection

**TDD Step 1: Write Tests First**

Create `apps/atnd-me/tests/int/tenants-collection.int.spec.ts`:

- Test tenant creation with required fields
- Test tenant slug uniqueness
- Test tenant access control (only admins can create/update/delete)
- Test tenant-admin can read tenants
- Test regular users cannot access tenants
- Test public read access for tenants listing page (read: () => true)
- Test tenants can be queried without authentication for listing page
- Test that default data is created when tenant is created:
  - Default home page with HeroScheduleBlock
  - Default class options (2-3 options)
  - Default lessons (2-3 upcoming lessons)
  - Default instructor (optional)
  - Default navbar and footer

**TDD Step 2: Implement**

Create `apps/atnd-me/src/collections/Tenants/index.ts`:

- Fields: 
  - `name` (text, required) - Display name of tenant
  - `slug` (text, unique, required) - Subdomain slug (e.g., "tenant1")
  - `domain` (text, optional) - Custom domain if applicable
  - `description` (textarea, optional) - Description for tenants listing page
  - `logo` (upload, optional) - Logo/image for tenants listing page
   - **Phase 2 (Stripe Connect)**: `stripeConnectAccountId` (text, optional) - Stripe Connect account ID for this tenant
   - **Phase 2 (Stripe Connect)**: `stripeConnectOnboardingStatus` (select, optional) - Status of Stripe Connect onboarding (pending, active, restricted)
   - **Phase 2 (Class Passes)**: `classPassSettings` (group, optional) - Class pass configuration for tenant
     - `enabled` (checkbox) - Enable class passes
     - `defaultExpirationDays` (number) - Default expiration period
     - `pricing` (array) - Available pass packages
  - **Phase 3 (Application Fees)**: `applicationFeeOverrides` (group, optional) - Per-tenant fee overrides
    - `dropInFee` (number, optional) - Override default drop-in fee (percentage or fixed amount)
    - `subscriptionFee` (number, optional) - Override default subscription fee (percentage or fixed amount)
    - `feeType` (select, optional) - Override fee type (percentage or fixed) - if not set, uses global default
- Access: 
  - `read`: Public access (`() => true`) for tenants listing page
  - `create/update/delete`: Only admins
  - **Phase 2**: `stripeConnectAccountId` and `stripeConnectOnboardingStatus` only readable/updatable by tenant-admin and super admin
- Admin: Group under "Configuration"
- Hooks:
  - `afterChange`: Create default data when tenant is created (operation === 'create')

### 3. Convert Globals to Collections

#### 3.1 Convert Header to Collection

- Create `apps/atnd-me/src/collections/Navbar/index.ts`
- Move fields from `apps/atnd-me/src/Header/config.ts`
- Configure with `isGlobal: true` in multi-tenant plugin

#### 3.2 Convert Footer to Collection

- Create `apps/atnd-me/src/collections/Footer/index.ts`
- Move fields from `apps/atnd-me/src/Footer/config.ts`
- Configure with `isGlobal: true` in multi-tenant plugin

#### 3.3 Convert Scheduler to Collection

- Modify `packages/bookings/bookings-plugin/src/globals/scheduler.tsx` to support collection mode
- Create `apps/atnd-me/src/collections/Scheduler/index.ts` wrapper
- Configure with `isGlobal: true` in multi-tenant plugin

### 4. Configure Multi-Tenant Plugin

Update `apps/atnd-me/src/plugins/index.ts` to add multi-tenant plugin:

```typescript
multiTenantPlugin({
  tenantCollectionSlug: 'tenants',
  collections: {
    // Standard collections
    pages: {},
    lessons: {},
    instructors: {},
    'class-options': {},
    bookings: {}, // Tenant-scoped for tracking which tenant bookings belong to
    
    // Globals converted to collections
    navbar: { isGlobal: true },
    footer: { isGlobal: true },
    scheduler: { isGlobal: true },
    
    // Users with custom access control
    users: {
      useUsersTenantFilter: false, // We'll implement custom access
    },
  },
})
```

### 5. Update Roles Configuration

**TDD Step 1: Write Tests First**

Create `apps/atnd-me/tests/int/roles.int.spec.ts`:

- Test that three roles exist: admin, tenant-admin, user
- Test that first user gets admin role
- Test that new users get user role by default
- Test that tenant-admin role exists in better auth config
- Test that tenant-admin can access admin panel

**TDD Step 2: Implement**

#### 5.1 Update Roles Plugin

Update `apps/atnd-me/src/plugins/index.ts`:

- Change roles from `['user', 'admin']` to `['admin', 'tenant-admin', 'user']`
- Update `defaultRole` to `'user'`
- Update `firstUserRole` to `'admin'` (first user becomes super admin)

#### 5.2 Update Better Auth Options

Update `apps/atnd-me/src/lib/auth/options.ts`:

- Add `'tenant-admin'` to `roles` array
- Add `'tenant-admin'` to `adminRoles` array (so tenant-admins can access admin panel)
- Keep `defaultRole` as `'user'`
- Keep `defaultAdminRole` as `'admin'`

### 6. Package Compatibility with Roles

#### 6.1 Understanding Current Role Checks

The monorepo packages extensively use `checkRole(["admin"], user) `from `@repo/shared-utils`. These checks need to be updated to support `tenant-admin` role while maintaining security.

**Current Pattern:**

- Packages check `checkRole(["admin"], user)` for admin-only operations
- This works for super admin but excludes tenant-admin

**Solution:**

- For **tenant-scoped collections** (lessons, instructors, class-options, bookings): Allow both `admin` and `tenant-admin`
- For **system-wide operations** (managing tenants, system config): Only allow `admin` (super admin)
- Multi-tenant plugin automatically filters by tenant, so tenant-admin checks are naturally scoped

#### 6.2 Create Admin Role Helper

Create `packages/shared-utils/src/check-admin-role.ts`:

```typescript
// Checks if user is admin (super admin) or tenant-admin
// For tenant-scoped operations, tenant-admin should be allowed
// For system operations, only super admin should be allowed
export const checkAdminRole = (
  roles: ("admin" | "tenant-admin")[],
  user: User | null,
  requireSuperAdmin: boolean = false
): boolean => {
  if (requireSuperAdmin) {
    return checkRole(["admin"], user);
  }
  return checkRole(roles, user);
};
```

#### 6.3 Update Package Access Controls

**Option A: Update packages to accept tenant-admin (Recommended)**

- Update `packages/bookings/bookings-plugin` access controls to allow `tenant-admin`
- Update `packages/shared-services` access functions to support tenant-admin
- Keep system operations (tenant management) as super-admin only

**Option B: Override in atnd-me app (Simpler, less invasive)**

- Keep packages unchanged
- Override access controls in atnd-me app config for tenant-scoped collections
- Use plugin overrides to add tenant-admin support

**Recommended Approach:** Use Option B initially (override in app), then gradually migrate packages if needed.

#### 6.4 Update Bookings Plugin Overrides (MVP)

In `apps/atnd-me/src/plugins/index.ts`, update bookingsPlugin configuration for MVP:

```typescript
bookingsPlugin({
  enabled: true,
  lessonsOverrides: {
    access: ({ defaultAccess }) => ({
      ...defaultAccess,
      create: ({ req: { user } }) => 
        checkRole(["admin", "tenant-admin"], user as User | null),
      update: ({ req: { user } }) => 
        checkRole(["admin", "tenant-admin"], user as User | null),
      delete: ({ req: { user } }) => 
        checkRole(["admin", "tenant-admin"], user as User | null),
    }),
  },
  instructorsOverrides: {
    access: ({ defaultAccess }) => ({
      ...defaultAccess,
      create: ({ req: { user } }) => 
        checkRole(["admin", "tenant-admin"], user as User | null),
      update: ({ req: { user } }) => 
        checkRole(["admin", "tenant-admin"], user as User | null),
      delete: ({ req: { user } }) => 
        checkRole(["admin", "tenant-admin"], user as User | null),
    }),
  },
  classOptionsOverrides: {
    access: ({ defaultAccess }) => ({
      ...defaultAccess,
      create: ({ req: { user } }) => 
        checkRole(["admin", "tenant-admin"], user as User | null),
      update: ({ req: { user } }) => 
        checkRole(["admin", "tenant-admin"], user as User | null),
      delete: ({ req: { user } }) => 
        checkRole(["admin", "tenant-admin"], user as User | null),
    }),
  },
  bookingOverrides: {
    access: ({ defaultAccess }) => ({
      ...defaultAccess,
      // MVP: Use default booking access (no payment validation)
      // Allow tenant-admin to manage bookings in their tenant
      // Multi-tenant plugin automatically filters by tenant
    }),
  },
})
```

**Note:** Payment validation will be added in Phase 2. MVP uses default booking access controls.

### 7. Implement Custom User Access Control

#### 6.1 Add Tenant Assignment Fields

Update `apps/atnd-me/src/collections/Users/index.ts`:

- Add `registrationTenant` field (relationship to tenants, optional) - tracks where user registered
- Add `tenant` field (relationship to tenants, optional) - for tenant-admin assignment
- Add hook to automatically set `registrationTenant` based on subdomain during user creation
- Add validation: if user has `tenant-admin` role, `tenant` field is required

#### 6.2 Custom Access Control

Create `apps/atnd-me/src/access/userTenantAccess.ts`:

- `read`: Users visible if:
  - Super admin (`admin` role) - can see all
  - Tenant admin (`tenant-admin` role) - can see users in their assigned tenant
  - User's `registrationTenant` matches current tenant, OR
  - User has bookings with lessons belonging to current tenant
- `update`: 
  - Super admin can update anyone
  - Tenant admin can only update users in their tenant
  - Users can update themselves
- `delete`: Only super admins
- `create`: Super admins and tenant admins (tenant admins create users in their tenant)

#### 6.3 Collection-Level Access Control

Update all tenant-scoped collections (pages, lessons, instructors, class-options, bookings, navbar, footer, scheduler):

- `read`: 
  - Super admin can read all
  - Tenant admin can only read their tenant's data
  - Public read access filtered by tenant context
- `create`/`update`/`delete`:
  - Super admin can do all operations
  - Tenant admin can only operate on their tenant's data
  - Regular users follow existing access rules

### 8. Update Bookings Plugin Integration (MVP - No Payments)

**TDD Step 1: Write Tests First**

Create `apps/atnd-me/tests/int/booking-access-control.int.spec.ts`:

- Test that bookings can be created without payment validation (MVP)
- Test cross-tenant booking: user from Tenant A booking lesson in Tenant B
- Test that bookings inherit tenant from lesson
- Test that tenant-admin can manage bookings in their tenant
- Test that tenant-admin cannot manage bookings in other tenants
- Test that super admin can manage all bookings
- Test booking status management (pending, confirmed, cancelled, waiting)
- **Phase 2 (Future)**: Test payment method validation
- **Phase 2 (Future)**: Test subscription validation

**TDD Step 2: Implement (MVP)**

The bookings plugin already creates tenant-scoped collections. For MVP:

- `bookings` collection is tenant-scoped (via multi-tenant plugin)
- Bookings automatically inherit tenant from the lesson they're booking
- Access control allows cross-tenant bookings but filters by tenant for admin views
- **MVP**: Use default booking access controls (no payment validation)
- **MVP**: Bookings can be created directly without payment checks
- Override booking access only to add tenant-admin support

**MVP Implementation:**

In `apps/atnd-me/src/plugins/index.ts`:

```typescript
bookingsPlugin({
  enabled: true,
  bookingOverrides: {
    access: ({ defaultAccess }) => ({
      ...defaultAccess,
      // MVP: Use default access, just ensure tenant-admin can manage bookings
      // No payment validation needed for MVP
      // Multi-tenant plugin automatically filters by tenant
    }),
  },
})
```

#### 8.1 Phase 2: Payment Method Validation (Future)

**When adding payments in Phase 2:**

**Challenge:**

- Users can book across tenants (cross-tenant capability)
- Payment method validation checks user subscriptions against lesson's allowed plans
- Subscriptions, plans, and class-options are tenant-scoped
- Need to validate subscriptions from the **lesson's tenant**, not the user's registration tenant

**Solution:**

Create `apps/atnd-me/src/access/bookingAccess.ts`:

```typescript
import { bookingCreateMembershipDropinAccess as baseAccess } from '@repo/shared-services'
import { AccessArgs, Booking } from 'payload'
import { getTenantFromLesson } from '@/utilities/getTenantFromLesson'

export const bookingCreateMembershipDropinAccess = async (args: AccessArgs<Booking>) => {
  const { req, data } = args
  
  // Get tenant from lesson
  const lessonId = typeof data?.lesson === 'object' ? data?.lesson.id : data?.lesson
  const tenantId = await getTenantFromLesson(lessonId, req.payload)
  
  // Set tenant context for subscription validation
  req.context = { ...req.context, tenant: tenantId }
  
  // Call base access control with payment validation
  return baseAccess(args)
}
```

**Key Points for Phase 2:**

- Multi-tenant plugin automatically filters queries by tenant context
- When checking subscriptions, ensure tenant context matches lesson's tenant
- Users can have subscriptions in multiple tenants
- Validation checks subscriptions in the **lesson's tenant**, not user's registration tenant

### 10. Tenant Onboarding - Default Data Creation

**TDD Step 1: Write Tests First**

Create `apps/atnd-me/tests/int/tenant-onboarding.int.spec.ts`:

- Test that creating a tenant triggers default data creation
- Test that default home page is created with HeroScheduleBlock
- Test that default class options are created (2-3 options)
- Test that default lessons are created (2-3 upcoming lessons)
- Test that default navbar and footer are created
- Test that all default data is scoped to the tenant
- Test that default data uses tenant context correctly
- Test that default instructor is created (if applicable)

**TDD Step 2: Implement**

Create `apps/atnd-me/src/collections/Tenants/hooks/createDefaultData.ts`:

This hook will automatically create default data when a tenant is created to help new tenants understand the application.

**Default Data Created:**

1. **Default Home Page** (`slug: 'home'`):

   - HeroScheduleBlock with:
     - Background image (use default/placeholder or tenant logo)
     - Title: "Welcome to {tenant.name}"
     - CTA button: "Book a Class" linking to `/bookings`
   - Additional blocks (optional):
     - About block with description
     - Location block (if applicable)
     - FAQs block with common questions

2. **Default Class Options** (2-3 options):

   - "Yoga Class" - 10 places - "A relaxing yoga class for all levels"
   - "Fitness Class" - 15 places - "High-intensity fitness training"
   - "Small Group Class" - 5 places (optional) - "Intimate small group session"

3. **Default Lessons** (2-3 upcoming lessons):

   - Tomorrow at 10:00-11:00 (Yoga Class)
   - Day after tomorrow at 14:00-15:00 (Fitness Class)
   - 3 days from now at 16:00-17:00 (optional)
   - All active, with default lockOutTime (30 minutes)
   - Use default class options created above

4. **Default Instructor** (optional):

   - Create a placeholder instructor user
   - Or skip if instructors require manual setup
   - Assign to default lessons if created

5. **Default Navbar**:

   - Basic navigation items:
     - Home (link to `/`)
     - Bookings (link to `/bookings`)
   - Use tenant logo if available

6. **Default Footer**:

   - Basic footer with copyright text
   - Optional: Links to pages

**Implementation:**

**Note:** Reference `apps/atnd-me/src/endpoints/seed/home.ts` and `apps/atnd-me/src/endpoints/seed/bookings.ts` for the structure of default data. The onboarding hook should create similar data but scoped to the tenant.

```typescript
// apps/atnd-me/src/collections/Tenants/hooks/createDefaultData.ts
import type { Payload, PayloadRequest } from 'payload'
import type { Tenant } from '@/payload-types'
import { home } from '@/endpoints/seed/home' // Reuse home page structure

export const createDefaultTenantData = async ({
  tenant,
  payload,
  req,
}: {
  tenant: Tenant
  payload: Payload
  req: PayloadRequest
}) => {
  // Set tenant context for all operations
  req.context = { ...req.context, tenant: tenant.id }
  
  // Get or create default media (background image, logo)
  // Use tenant logo if available, otherwise use placeholder
  // Reference: apps/atnd-me/src/endpoints/seed/index.ts for media creation
  
  // 1. Create default class options
  // Reference: apps/atnd-me/src/endpoints/seed/bookings.ts lines 225-258
  const classOptions = await Promise.all([
    payload.create({
      collection: 'class-options',
      data: {
        name: 'Yoga Class',
        places: 10,
        description: 'A relaxing yoga class for all levels',
      },
      req, // Maintains tenant context
    }),
    payload.create({
      collection: 'class-options',
      data: {
        name: 'Fitness Class',
        places: 15,
        description: 'High-intensity fitness training',
      },
      req,
    }),
    // Optional: Small Group Class
  ])
  
  // 2. Create default home page with HeroScheduleBlock
  // Reference: apps/atnd-me/src/endpoints/seed/home.ts for structure
  // Use home() helper function but customize for tenant
  const homePageData = home({
    heroImage: defaultBackgroundImage,
    metaImage: defaultBackgroundImage,
    logo: tenant.logo || null,
  })
  
  // Customize title and HeroScheduleBlock
  homePageData.title = `Welcome to ${tenant.name}`
  if (homePageData.layout && homePageData.layout[0]?.blockType === 'heroSchedule') {
    homePageData.layout[0].title = `Welcome to ${tenant.name}`
    homePageData.layout[0].logo = tenant.logo?.id || undefined
  }
  
  await payload.create({
    collection: 'pages',
    data: {
      ...homePageData,
      slug: 'home',
    },
    req,
  })
  
  // 3. Create default lessons (2-3 upcoming lessons)
  // Reference: apps/atnd-me/src/endpoints/seed/bookings.ts lines 260-350
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(10, 0, 0, 0)
  const tomorrowEnd = new Date(tomorrow)
  tomorrowEnd.setHours(11, 0, 0, 0)
  
  await payload.create({
    collection: 'lessons',
    data: {
      date: tomorrow.toISOString(),
      startTime: tomorrow.toISOString(),
      endTime: tomorrowEnd.toISOString(),
      classOption: classOptions[0].id,
      location: 'Main Studio',
      active: true,
      lockOutTime: 30,
      // Note: Instructor is optional - can be null or create placeholder
    },
    req,
  })
  
  // Create additional lessons (day after tomorrow, etc.)
  
  // 4. Create default navbar
  await payload.create({
    collection: 'navbar',
    data: {
      navItems: [
        {
          link: {
            type: 'reference',
            reference: { relationTo: 'pages', value: homePageId },
            label: 'Home',
          },
        },
        {
          link: {
            type: 'custom',
            url: '/bookings',
            label: 'Bookings',
          },
        },
      ],
    },
    req,
  })
  
  // 5. Create default footer
  await payload.create({
    collection: 'footer',
    data: {
      copyright: `© ${new Date().getFullYear()} ${tenant.name}. All rights reserved.`,
      // Add footer links if needed
    },
    req,
  })
}
```

**Add to Tenants Collection:**

```typescript
// apps/atnd-me/src/collections/Tenants/index.ts
import { createDefaultTenantData } from './hooks/createDefaultData'

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  // ... fields ...
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation === 'create') {
          await createDefaultTenantData({
            tenant: doc,
            payload: req.payload,
            req,
          })
        }
      },
    ],
  },
}
```

**Key Points:**

- All default data must be created with tenant context set (`req.context.tenant`)
- Multi-tenant plugin automatically assigns tenant to all collections
- Default data should be minimal but helpful for onboarding
- Tenants can customize/delete default data after creation
- Use `req` parameter in all payload operations to maintain tenant context

### 11. Frontend Integration

**TDD Step 1: Write Tests First**

Create `apps/atnd-me/tests/e2e/tenant-routing.e2e.spec.ts`:

- Test subdomain routing (tenant1.atnd-me.com shows tenant1's data)
- Test root domain shows marketing landing page
- Test /tenants page lists all tenants with links
- Test marketing landing page links to /tenants page
- Test that each tenant sees their own home page
- Test that pages are filtered by tenant
- Test that navbar/footer are tenant-specific

**TDD Step 2: Implement**

#### 7.1 Next.js Middleware

Create `apps/atnd-me/src/middleware.ts`:

- Extract subdomain from request hostname
- Handle root domain (`atnd-me.com`) - redirect to default tenant or show tenant selector
- Look up tenant by subdomain slug
- Set tenant context in headers (`x-tenant-id`) and cookies for Payload API calls
- Pass tenant context to all requests

#### 7.2 Landing Page Handling

**Root Domain (`atnd-me.com`):**

- **Option C Selected**: Show marketing/landing page with tenant selection
- Create marketing landing page at root route (`/`)
- Include call-to-action linking to `/tenants` page
- Marketing page should be tenant-agnostic (no tenant context required)

**Tenants Listing Page (`/tenants`):**

- Create new route: `apps/atnd-me/src/app/(frontend)/tenants/page.tsx`
- Query all tenants from `tenants` collection (public access, no tenant filtering)
- Display list of tenants with:
  - Tenant name
  - Tenant description (if available)
  - Link to tenant subdomain (e.g., `https://tenant1.atnd-me.com`)
  - Optional: Tenant logo/image if available
- Public access (no authentication required)
- No tenant context needed (shows all tenants)
- Use `overrideAccess: true` or public access control to query all tenants

**Subdomain (`tenant1.atnd-me.com`):**

- Show that tenant's "home" page (slug: "home")
- Query pages collection filtered by current tenant
- All routes automatically scoped to tenant

**Implementation:**

- Create `apps/atnd-me/src/app/(frontend)/page.tsx`:
  - Check if tenant context exists (from middleware via subdomain)
  - If no tenant (root domain): Show marketing landing page component
  - If tenant exists: Redirect to tenant's home page or show tenant's home page (slug: "home")
  - Marketing page should include:
    - Hero section with value proposition
    - Call-to-action button linking to `/tenants`
    - No tenant-specific data (static or from non-tenant-scoped source)
- Create `apps/atnd-me/src/app/(frontend)/tenants/page.tsx`:
  - Query all tenants using Payload Local API with `overrideAccess: true`
  - Or create public access control for tenants collection (read: () => true)
  - Display tenant list in a grid or list layout
  - Each tenant card/link should:
    - Show tenant name and description
    - Link to `https://{tenant.slug}.atnd-me.com` (or custom domain if set)
    - Be visually appealing and clickable
- Update `apps/atnd-me/src/app/(frontend)/[slug]/page.tsx`:
  - `queryPageBySlug` must include tenant filter in `where` clause
  - Multi-tenant plugin automatically adds tenant filtering, but ensure tenant context is set
  - `generateStaticParams` should be disabled or made tenant-aware (use dynamic rendering)
  - Skip tenant filtering for special routes like `/tenants`

#### 7.3 Update API Routes

- All Payload API calls must include tenant context
- Frontend components fetch data filtered by current tenant
- Create utility function `getTenantFromRequest(req)` to extract tenant from headers/cookies

#### 7.4 Update Components

- `apps/atnd-me/src/app/(frontend)/**` routes need tenant context
- Header/Footer components fetch from tenant-scoped collections (navbar/footer collections)
- Booking pages respect tenant boundaries
- Create `apps/atnd-me/src/utilities/getTenantContext.ts` helper for consistent tenant access

### 12. Update Payload Config

Modify `apps/atnd-me/src/payload.config.ts`:

- Add `Tenants` collection to collections array
- Remove `Header`, `Footer` from globals (now collections)
- Remove `scheduler` from globals (now collection)
- Add multi-tenant plugin to plugins array

### 13. Database Migration

Create migration to:

- Add `tenants` table
- Add `tenant` foreign key to all tenant-scoped collections
- Add `registrationTenant` and `tenant` fields to users table
- Update existing admin users to keep `admin` role
- Convert existing data (assign to default tenant or create migration script)

### 14. Update Seed Script

Modify `apps/atnd-me/scripts/seed.ts`:

- Create default tenant
- Assign all existing data to default tenant
- Create test tenants for multi-tenant testing
- Note: Default data will be automatically created via tenant onboarding hook

## Key Files to Modify

1. `apps/atnd-me/src/payload.config.ts` - Add plugin and update collections/globals
2. `apps/atnd-me/src/plugins/index.ts` - Update roles plugin, add multi-tenant plugin, and override bookings plugin access controls
3. `apps/atnd-me/src/lib/auth/options.ts` - Update roles to include tenant-admin
4. `apps/atnd-me/src/collections/Users/index.ts` - Add registrationTenant, tenant fields and hooks
5. `packages/shared-utils/src/check-admin-role.ts` - New helper for checking admin/tenant-admin roles (optional)
6. `apps/atnd-me/src/collections/Tenants/index.ts` - New collection with onboarding hook (Phase 2: add Stripe Connect fields)
7. `apps/atnd-me/src/collections/Tenants/hooks/createDefaultData.ts` - Hook to create default data for new tenants
8. **Phase 2**: `apps/atnd-me/src/lib/stripe-connect.ts` - Tenant-aware Stripe Connect helper
9. **Phase 2**: `apps/atnd-me/src/app/api/stripe/connect/authorize/route.ts` - Stripe Connect OAuth initiation
10. **Phase 2**: `apps/atnd-me/src/app/api/stripe/connect/callback/route.ts` - Stripe Connect OAuth callback
11. **Phase 2**: `apps/atnd-me/src/collections/ClassPasses/index.ts` - Class passes collection (tenant-scoped)
12. **Phase 2**: `apps/atnd-me/src/app/api/class-passes/purchase/route.ts` - Class pass purchase endpoint
13. **Phase 2**: `apps/atnd-me/src/app/(frontend)/class-passes/purchase/page.tsx` - Class pass purchase UI
14. **Phase 2**: `apps/atnd-me/src/utilities/checkClassPass.ts` - Utility to validate class pass for booking
15. **Phase 2**: `apps/atnd-me/src/hooks/useClassPassForBooking.ts` - Hook to decrement pass on booking confirmation
16. **Phase 3**: `apps/atnd-me/src/globals/ApplicationFees/index.ts` - Global configuration for default application fees
17. **Phase 3**: `apps/atnd-me/src/utilities/calculateApplicationFee.ts` - Utility to calculate application fees with tenant overrides
18. `apps/atnd-me/src/collections/Navbar/index.ts` - New collection (from Header global)
19. `apps/atnd-me/src/collections/Footer/index.ts` - New collection (from Footer global)
20. `apps/atnd-me/src/collections/Scheduler/index.ts` - New collection (from scheduler global)
21. `apps/atnd-me/src/access/userTenantAccess.ts` - New access control functions for users
22. `apps/atnd-me/src/access/tenantAccess.ts` - New access control functions for tenant-scoped collections
23. `apps/atnd-me/src/middleware.ts` - New middleware for tenant detection
24. `apps/atnd-me/src/utilities/getTenantContext.ts` - Helper to get tenant from request
25. `apps/atnd-me/src/utilities/getTenantFromLesson.ts` - Helper to extract tenant from lesson
26. `apps/atnd-me/src/access/bookingAccess.ts` - Custom booking access controls (Phase 2 - for payment validation, not needed for MVP)
27. `apps/atnd-me/src/app/(frontend)/page.tsx` - Create marketing landing page for root domain
28. `apps/atnd-me/src/app/(frontend)/tenants/page.tsx` - Create tenants listing page
29. `apps/atnd-me/src/app/(frontend)/[slug]/page.tsx` - Update queryPageBySlug to include tenant filtering
30. `packages/bookings/bookings-plugin/src/globals/scheduler.tsx` - May need updates for collection mode

## Test Files to Create

### Test Infrastructure

- `apps/atnd-me/tests/helpers/tenant-test-helpers.ts` - Test utilities for tenant operations
- `apps/atnd-me/tests/int/multi-tenant.config.ts` - Test Payload config with multi-tenant plugin

### Unit Tests

- `apps/atnd-me/tests/unit/tenant-helpers.test.ts` - Test tenant utility functions
- `apps/atnd-me/tests/unit/getTenantContext.test.ts` - Test tenant context extraction
- `apps/atnd-me/tests/unit/getTenantFromLesson.test.ts` - Test tenant extraction from lesson
- `apps/atnd-me/tests/unit/middleware.test.ts` - Test middleware tenant detection

### Integration Tests

- `apps/atnd-me/tests/int/multi-tenant-plugin.int.spec.ts` - Plugin configuration tests
- `apps/atnd-me/tests/int/tenants-collection.int.spec.ts` - Tenant collection tests
- `apps/atnd-me/tests/int/tenant-onboarding.int.spec.ts` - Tenant onboarding and default data creation tests
- `apps/atnd-me/tests/int/roles.int.spec.ts` - Role configuration tests
- `apps/atnd-me/tests/int/user-access-control.int.spec.ts` - User access control tests
- `apps/atnd-me/tests/int/tenant-access-control.int.spec.ts` - Collection-level access tests
- `apps/atnd-me/tests/int/booking-access-control.int.spec.ts` - Booking access control tests (MVP - no payment validation)
- `apps/atnd-me/tests/int/collections-tenant-scoping.int.spec.ts` - Collection scoping tests

### E2E Tests

- `apps/atnd-me/tests/e2e/tenant-routing.e2e.spec.ts` - Subdomain routing tests
- `apps/atnd-me/tests/e2e/marketing-landing.e2e.spec.ts` - Marketing landing page and tenants listing tests
- `apps/atnd-me/tests/e2e/cross-tenant-booking.e2e.spec.ts` - Cross-tenant booking tests
- `apps/atnd-me/tests/e2e/tenant-admin-access.e2e.spec.ts` - Tenant-admin access tests
- `apps/atnd-me/tests/e2e/super-admin-access.e2e.spec.ts` - Super admin access tests

## Testing Strategy (TDD)

### Test Categories

#### Unit Tests (`tests/unit/`)

- `tenant-helpers.test.ts` - Test tenant utility functions
- `getTenantContext.test.ts` - Test tenant context extraction
- `getTenantFromLesson.test.ts` - Test tenant extraction from lesson
- `middleware.test.ts` - Test middleware tenant detection logic

#### Integration Tests (`tests/int/`)

- `multi-tenant-plugin.int.spec.ts` - Plugin configuration and tenant field injection
- `tenants-collection.int.spec.ts` - Tenant CRUD operations and access control
- `roles.int.spec.ts` - Role configuration and assignment
- `user-access-control.int.spec.ts` - User visibility and access control
- `tenant-access-control.int.spec.ts` - Collection-level tenant access control
- `booking-payment-validation.int.spec.ts` - Cross-tenant booking and payment validation
- `collections-tenant-scoping.int.spec.ts` - Test all tenant-scoped collections

#### E2E Tests (`tests/e2e/`)

- `tenant-routing.e2e.spec.ts` - Subdomain routing and tenant detection
- `cross-tenant-booking.e2e.spec.ts` - User booking across tenants
- `tenant-admin-access.e2e.spec.ts` - Tenant-admin access restrictions
- `super-admin-access.e2e.spec.ts` - Super admin access to all tenants

### Test Data Management

- Each test suite creates isolated test data
- Test tenants: `test-tenant-1`, `test-tenant-2`
- Test users: Super admin, tenant-admin per tenant, regular users
- Test cleanup after each test suite

### Test Execution Order

1. **Setup Phase**: Create test infrastructure and helpers
2. **Unit Tests**: Test utilities and helpers in isolation
3. **Integration Tests**: Test Payload collections and plugins
4. **E2E Tests**: Test full user flows

### Key Test Scenarios

- ✅ Subdomain routing and tenant detection
- ✅ Cross-tenant booking capability
- ✅ User visibility restrictions per tenant
- ✅ Super admin access to all tenants
- ✅ Tenant-admin access restricted to their tenant only
- ✅ Tenant-admin cannot access other tenants' data
- ✅ Tenant-admin has admin-like permissions within their tenant
- ✅ Packages work correctly with tenant-admin role
- ✅ System operations (tenant management) remain super-admin only
- ✅ Cross-tenant booking capability (MVP - no payment validation)
- ✅ Bookings can be created without payment checks (MVP)
- ✅ Bookings inherit tenant from lesson
- **Phase 2 (Future)**: Payment method validation with subscriptions
- **Phase 2 (Future)**: Subscription validation checks subscriptions from lesson's tenant
- **Phase 2 (Future)**: Plans, subscriptions, and class-options are properly tenant-scoped
- Test that existing data migrates correctly
- Test that new tenants get isolated data
- Test that new tenants get default onboarding data (home page, class options, lessons, navbar, footer)
- Test that default data is properly scoped to tenant

## Migration Strategy

1. Create tenants collection and default tenant
2. Run migration to add tenant fields to all collections
3. Assign existing data to default tenant
4. Deploy with multi-tenant plugin enabled
5. Test thoroughly before creating additional tenants

## Phase 2: Payment Functionality (Future)

When adding payment functionality:

1. **Add Payment Plugins:**

   - Enable `paymentsPlugin` in plugins array
   - Enable `membershipsPlugin` in plugins array
   - Configure Stripe integration

2. **Stripe Connect Integration:**

   - **Add Stripe Connect Fields to Tenants Collection:**
     - `stripeConnectAccountId` (text) - Store Stripe Connect account ID
     - `stripeConnectOnboardingStatus` (select) - Track onboarding status
   - **Create Stripe Connect OAuth Flow:**
     - Endpoint to initiate Stripe Connect OAuth (`/api/stripe/connect/authorize`)
     - Callback endpoint to handle OAuth response (`/api/stripe/connect/callback`)
     - Store `stripeConnectAccountId` in tenant record after successful connection
   - **Create Tenant-Aware Stripe Instance Helper:**
     - `apps/atnd-me/src/lib/stripe-connect.ts` - Get Stripe instance for specific tenant
     - Use `stripe.accounts.retrieve(tenant.stripeConnectAccountId)` to get account details
     - Create payment intents with `on_behalf_of` parameter for Connect accounts
     - **Note:** Application fees will be added in Phase 3, but structure should support `application_fee_amount` parameter
   - **Update Payment Endpoints:**
     - Modify `create-payment-intent.ts` to use tenant's Stripe Connect account
     - Route payments to correct Connect account based on tenant context
     - Update webhook handlers to identify tenant from webhook payload
   - **Webhook Routing:**
     - Stripe Connect webhooks include `account` field in payload
     - Match `account` to `stripeConnectAccountId` in tenants collection
     - Set tenant context before processing webhook
     - Handle Connect-specific events: `account.updated`, `account.application.deauthorized`

3. **Update Booking Access Controls:**

   - Implement `bookingAccess.ts` with payment validation
   - Add `getTenantFromLesson.ts` utility
   - Update booking access to validate:
     - **Subscriptions**: Check user has valid subscription from lesson's tenant
     - **Class Passes**: Check user has valid, non-expired class pass for lesson's tenant (see section 7)
     - **Drop-ins**: Allow direct payment if class option allows drop-ins
   - **Stripe Connect**: Ensure payment validation uses tenant's Connect account
   - Priority order: Subscription > Class Pass > Drop-in payment

4. **Update Class Options:**

   - Add `paymentMethods` field to class-options
   - Configure allowed plans per class option
   - Add `allowedClassPasses` (checkbox or relationship) - Whether class passes can be used for this class option

5. **Add Class Passes Collection:**

   - Create `apps/atnd-me/src/collections/ClassPasses/index.ts`
   - Fields:
     - `user` (relationship to users, required) - Owner of the class pass
     - `tenant` (relationship to tenants, required) - Tenant this pass belongs to (tenant-scoped)
     - `quantity` (number, required, min: 1) - Number of passes/credits remaining
     - `originalQuantity` (number, required) - Original quantity when purchased (for tracking)
     - `expirationDate` (date, required) - Date when passes expire
     - `purchasedAt` (date, required, default: now) - When the pass was purchased
     - `price` (number, required) - Price paid for the pass (in cents)
     - `transaction` (relationship to transactions, optional) - Stripe transaction reference
     - `status` (select, default: 'active') - Status: 'active', 'expired', 'used', 'cancelled'
     - `notes` (textarea, optional) - Admin notes
   - Access:
     - `read`: User can read their own passes, tenant-admin can read passes in their tenant, super admin can read all
     - `create`: Users can purchase passes (via API endpoint), tenant-admin and super admin can create manually
     - `update`: Only tenant-admin and super admin (users cannot modify their passes)
     - `delete`: Only super admin
   - Hooks:
     - `beforeChange`: Validate expiration date is in the future
     - `afterChange`: Update status to 'expired' if expirationDate has passed
   - Admin: Group under "Bookings"
   - Tenant-scoped: Yes (via multi-tenant plugin)

6. **Class Pass Purchase Flow:**

   - Create `apps/atnd-me/src/app/api/class-passes/purchase/route.ts`:
     - Accept: `quantity`, `expirationDays` (optional, default from tenant config), `tenantId`
     - Calculate price based on tenant's class pass pricing
     - Create Stripe payment intent with tenant's Connect account
     - On successful payment, create ClassPass record
     - Link transaction to class pass
   - Create `apps/atnd-me/src/app/(frontend)/class-passes/purchase/page.tsx`:
     - UI for purchasing class passes
     - Show available pass packages (if configured)
     - Handle payment flow

7. **Update Booking Access Controls for Class Passes:**

   - Modify `bookingAccess.ts`:
     - Check if user has valid class passes for the lesson's tenant
     - Validate pass hasn't expired (`expirationDate > now`)
     - Validate pass has remaining quantity (`quantity > 0`)
     - Validate class option allows class passes (`allowedClassPasses === true`)
     - Decrement pass quantity when booking is confirmed
   - Create `apps/atnd-me/src/utilities/checkClassPass.ts`:
     ```typescript
     export const checkClassPass = async ({
       user,
       tenant,
       classOption,
       payload,
     }: {
       user: User
       tenant: Tenant
       classOption: ClassOption
       payload: Payload
     }): Promise<{ valid: boolean; pass?: ClassPass; error?: string }> => {
       // 1. Check if class option allows class passes
       if (!classOption.paymentMethods?.allowedClassPasses) {
         return { valid: false, error: 'Class passes not allowed for this class' }
       }
       
       // 2. Find active, non-expired class pass for user in tenant
       const now = new Date()
       const passes = await payload.find({
         collection: 'class-passes',
         where: {
           user: { equals: user.id },
           tenant: { equals: tenant.id },
           status: { equals: 'active' },
           quantity: { greater_than: 0 },
           expirationDate: { greater_than: now.toISOString() },
         },
         limit: 1,
         sort: 'expirationDate',
       })
       
       if (passes.docs.length === 0) {
         return { valid: false, error: 'No valid class pass found' }
       }
       
       return { valid: true, pass: passes.docs[0] as ClassPass }
     }
     ```

   - Create `apps/atnd-me/src/hooks/useClassPassForBooking.ts`:
     - Hook to decrement class pass quantity when booking is confirmed
     - Update pass status to 'used' if quantity reaches 0
     - Add to booking's `afterChange` hook

8. **Add Collections:**

   - Plans collection (tenant-scoped)
   - Subscriptions collection (tenant-scoped)
   - Transactions collection (tenant-scoped)
   - **Class Passes collection (tenant-scoped)** - See above

9. **Class Pass Configuration:**

   - Add to Tenants collection (Phase 2):
     - `classPassSettings` (group, optional):
       - `enabled` (checkbox, default: false) - Enable class passes for this tenant
       - `defaultExpirationDays` (number, default: 365) - Default expiration period for purchased passes
       - `pricing` (array) - Pass packages:
         - `quantity` (number) - Number of passes
         - `price` (number) - Price in cents
         - `name` (text) - Package name (e.g., "5-Pack", "10-Pack")
   - Or create separate `ClassPassPackages` collection (tenant-scoped) for more flexibility

10. **Update Tests:**

   - Add payment validation tests
   - Add subscription validation tests
   - Add cross-tenant payment tests
   - **Stripe Connect**: Add tests for OAuth flow, account creation, payment routing
   - **Class Passes**: Add tests for:
     - Class pass purchase flow
     - Expiration date validation
     - Booking with class passes
     - Pass quantity decrementing
     - Expired pass rejection
     - Cross-tenant pass validation (passes only work for their tenant)

**Architecture Note:** MVP is structured to support adding payments without major refactoring. All tenant-scoped collections are already set up, and access controls can be extended. The multi-tenant architecture with tenant context isolation is **perfectly suited for Stripe Connect**, as each tenant's payments are already isolated and can be routed to their respective Connect accounts.

**Stripe Connect Benefits:**

- Each tenant receives payments directly to their own Stripe account
- Platform can take application fees using Stripe Connect's fee structure
- Tenant financial data is isolated (compliance benefit)
- Tenants can manage their own Stripe dashboard independently
- Supports both Express and Custom Connect accounts (flexibility)

## Phase 3: Application Fee Management (Future)

When implementing flexible application fees:

1. **Create Application Fee Configuration Global:**

   - Create `apps/atnd-me/src/globals/ApplicationFees/index.ts`
   - Fields:
     - `defaultDropInFee` (number, required) - Default application fee for drop-in payments
     - `defaultSubscriptionFee` (number, required) - Default application fee for subscription payments
     - `feeType` (select, required) - How fees are calculated: `percentage` or `fixed`
       - If `percentage`: Fee is a percentage of the transaction amount (e.g., 2.9% + $0.30)
       - If `fixed`: Fee is a fixed amount in cents (e.g., $0.50 = 50 cents)
     - `currency` (text, default: 'eur') - Currency for fixed fees
   - Access: Only super admin (`admin` role) can read/update
   - Admin: Group under "Configuration"

2. **Update Tenants Collection:**

   - Add `applicationFeeOverrides` group field:
     - `dropInFee` (number, optional) - Override default drop-in fee
     - `subscriptionFee` (number, optional) - Override default subscription fee
     - `feeType` (select, optional) - Override fee type (percentage or fixed)
     - `enabled` (checkbox, default: false) - Enable fee overrides for this tenant
   - Access: Only super admin and tenant-admin can read/update their own tenant's overrides

3. **Create Application Fee Calculation Utility:**

   - Create `apps/atnd-me/src/utilities/calculateApplicationFee.ts`:
     ```typescript
     export const calculateApplicationFee = async ({
       tenant,
       paymentType, // 'drop-in' | 'subscription'
       amount, // Transaction amount in cents
       payload,
     }: {
       tenant: Tenant
       paymentType: 'drop-in' | 'subscription'
       amount: number
       payload: Payload
     }): Promise<number> => {
       // 1. Get global default fees
       const globalFees = await payload.findGlobal({
         slug: 'application-fees',
       })
       
       // 2. Check if tenant has overrides
       const useOverrides = tenant.applicationFeeOverrides?.enabled
       const feeType = useOverrides && tenant.applicationFeeOverrides?.feeType
         ? tenant.applicationFeeOverrides.feeType
         : globalFees.feeType
       
       const feeValue = useOverrides && tenant.applicationFeeOverrides?.[`${paymentType}Fee`]
         ? tenant.applicationFeeOverrides[`${paymentType}Fee`]
         : globalFees[`default${paymentType.charAt(0).toUpperCase() + paymentType.slice(1)}Fee`]
       
       // 3. Calculate fee based on type
       if (feeType === 'percentage') {
         return Math.round(amount * (feeValue / 100))
       } else {
         // Fixed amount (already in cents)
         return feeValue
       }
     }
     ```


4. **Update Stripe Connect Payment Creation:**

   - Modify `apps/atnd-me/src/lib/stripe-connect.ts`:
     - Add `calculateApplicationFee` import
     - When creating payment intents or checkout sessions:
       - Calculate application fee using `calculateApplicationFee`
       - Add `application_fee_amount` parameter to Stripe API calls
       - For subscriptions, use `application_fee_percent` or handle via transfer reversal
   - Update `create-payment-intent.ts`:
     - Determine payment type from metadata (drop-in vs subscription)
     - Calculate application fee based on tenant and payment type
     - Include application fee in payment intent creation

5. **Update Subscription Creation:**

   - For recurring subscriptions, Stripe Connect supports:
     - `application_fee_percent` - Percentage fee on each subscription payment
     - Or use `transfer_data` with `amount` for fixed fees
   - Update subscription creation endpoints to include calculated application fees

6. **Admin UI for Fee Management:**

   - Super admin can view/edit default fees in global settings
   - Super admin can view/edit per-tenant fee overrides
   - Tenant-admin can view (read-only) their own fee overrides
   - Display fee calculation preview (show example calculation)

7. **Add Tests:**

   - Test default fee calculation (percentage and fixed)
   - Test tenant-specific fee overrides
   - Test fee calculation for drop-in vs subscription
   - Test that overrides take precedence over defaults
   - Test that missing overrides fall back to defaults
   - Test edge cases (zero fees, 100% fees, negative amounts)

**Implementation Example:**

```typescript
// When creating a payment intent for a drop-in booking
const applicationFee = await calculateApplicationFee({
  tenant: currentTenant,
  paymentType: 'drop-in',
  amount: lessonPriceInCents,
  payload: req.payload,
})

const paymentIntent = await stripe.paymentIntents.create({
  amount: lessonPriceInCents,
  currency: 'eur',
  application_fee_amount: applicationFee,
  on_behalf_of: tenant.stripeConnectAccountId,
  transfer_data: {
    destination: tenant.stripeConnectAccountId,
  },
  // ... other params
})
```

**Key Features:**

- Super admin sets default fees globally
- Different fees for drop-in vs subscription payments
- Per-tenant fee overrides (optional)
- Supports both percentage and fixed fee types
- Automatic fallback to defaults if overrides not set
- Fee calculation is transparent and testable

### MVP vs Phase 2 vs Phase 3 Summary

| Feature | MVP (Phase 1) | Phase 2 (Future) |

|---------|---------------|-----------------|

| **Multi-tenant core** | ✅ Included | - |

| **Tenant management** | ✅ Included | - |

| **Role structure** | ✅ Included (admin, tenant-admin, user) | - |

| **User access control** | ✅ Included | - |

| **Tenant-scoped collections** | ✅ Included | - |

| **Cross-tenant bookings** | ✅ Included (without payment validation) | Enhanced with payment validation |

| **Booking creation** | ✅ Direct creation (no payment checks) | Payment validation required |

| **Payment plugins** | ❌ Excluded | ✅ Add paymentsPlugin, membershipsPlugin |

| **Subscription validation** | ❌ Excluded | ✅ Add subscription checks |

| **Payment processing** | ❌ Excluded | ✅ Add Stripe integration | - |

| **Stripe Connect** | ❌ Excluded | ✅ Add Stripe Connect for tenant-specific payment accounts | - |

| **Class Passes** | ❌ Excluded | ✅ Add class passes with expiration dates | - |

| **Application fees** | ❌ Excluded | ❌ Excluded | ✅ Add configurable application fees with per-tenant overrides |

| **Fee management UI** | ❌ Excluded | ❌ Excluded | ✅ Add admin UI for fee configuration |

| **Plans/Subscriptions** | ❌ Excluded | ✅ Add tenant-scoped plans/subscriptions |