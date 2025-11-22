# Better Auth UI Modal Implementation

## Overview
This document describes the implementation of modal authentication using `@daveyplate/better-auth-ui` package.

## Changes Made

### 1. Modal Auth Route (Intercepting Route)
**File:** `src/app/(frontend)/@unauthenticated/(.)auth/[...path]/page.tsx`

- Created intercepting route that shows auth UI in a modal when navigating to `/auth/*` paths
- Uses the existing `Modal` component for consistent modal behavior
- Wraps `AuthView` component from better-auth-ui
- Supports all auth views: sign-in, sign-up, forgot-password, reset-password

### 2. Updated Modal Component
**File:** `src/app/(frontend)/@unauthenticated/modal.tsx`

- Increased modal height to `max-h-[90vh]` for better-auth-ui forms
- Improved responsive sizing: `w-[95vw] max-w-[450px]`
- Added `overflow-y-auto` for scrollable content
- Reduced padding to `p-6` for better form layout
- Improved close button styling and accessibility

### 3. Auth Provider Updates
**File:** `src/lib/auth/auth-provider.tsx`

- Added callback URL handling on session change
- Wraps auth provider in Suspense boundary for `useSearchParams`
- Redirects to `callbackUrl` query parameter after successful authentication
- Falls back to `router.refresh()` if no callback URL is provided

### 4. Auth Client Updates
**File:** `src/lib/auth/auth-client.ts`

- Added `getCallbackUrl()` helper function to extract callback URL from current URL
- Defaults to `/dashboard` if no callback URL is present

### 5. Checkin Button Redirects
**Files Updated:**
- `packages/bookings/bookings-next/src/components/lessons/checkin-button.tsx`
- `packages/bookings/bookings-plugin/src/components/schedule/lessons/checkin-button.tsx`

**Changes:**
- Updated all auth redirects from `/login` to `/auth/sign-in`
- Updated all auth redirects from `/register` to `/auth/sign-up`
- Maintained `callbackUrl` query parameters for post-auth redirects
- For trialable classes: redirects to sign-up
- For other classes: redirects to sign-in

## Auth Flow

### Modal Authentication Flow
1. User clicks "Check In" on an unauthenticated lesson
2. Redirects to `/auth/sign-in?callbackUrl=/bookings/123`
3. Intercepting route shows auth modal with sign-in form
4. User completes authentication
5. `onSessionChange` handler reads `callbackUrl` from URL
6. User is redirected to original booking page (`/bookings/123`)

### Direct Page Authentication Flow
If user navigates directly to `/auth/sign-in`:
- Shows full-page auth view (not modal)
- Uses the same `AuthView` component
- Maintains consistency in authentication flow

## Routes

### Modal Routes (Intercepting)
- `/@unauthenticated/(.)auth/sign-in` - Login modal
- `/@unauthenticated/(.)auth/sign-up` - Registration modal
- `/@unauthenticated/(.)auth/forgot-password` - Password recovery modal
- `/@unauthenticated/(.)auth/reset-password` - Password reset modal

### Full-Page Routes
- `/auth/sign-in` - Login page
- `/auth/sign-up` - Registration page
- `/auth/forgot-password` - Password recovery page
- `/auth/reset-password` - Password reset page

## Benefits

1. **Better UX**: Users stay on the same page context while authenticating
2. **Consistent UI**: Uses better-auth-ui components everywhere
3. **Flexible**: Supports both modal and full-page auth flows
4. **Callback Support**: Seamlessly redirects users back to their intended destination
5. **Modern**: Uses Next.js 13+ parallel routes and intercepting routes patterns

## Testing Checklist

- [ ] Click "Check In" on an active lesson without being logged in
- [ ] Verify modal opens with sign-in form
- [ ] Complete sign-in in modal
- [ ] Verify redirect back to booking page
- [ ] Click "Book Trial Class" without being logged in
- [ ] Verify modal opens with sign-up form
- [ ] Navigate directly to `/auth/sign-in`
- [ ] Verify full-page view (not modal)
- [ ] Test forgot password flow
- [ ] Test email verification flow

## Notes

- The modal uses Next.js parallel routes (`@unauthenticated` slot)
- Better-auth-ui provides all form validation and error handling
- Session management is handled by better-auth
- All redirects maintain the callback URL through the auth flow

