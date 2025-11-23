# Magic Link Troubleshooting Guide

## Current Configuration Status

### ✅ Server-Side Configuration (Correct)
- Magic link plugin is configured in `src/lib/auth/options.ts`
- Plugin is included in the `betterAuthPlugins` array
- `sendMagicLink` callback is defined

### ✅ Client-Side Configuration (Correct)
- `magicLinkClient` plugin is imported and configured
- Client is properly initialized with the plugin

### ✅ Fixed Issues
1. **Base URL mismatch**: Updated server `baseURL` to fall back to `NEXT_PUBLIC_SERVER_URL`
2. **Client base URL**: Already configured to use the same fallback

## How Magic Link Works in better-auth-ui v3.2.11

In version 3.2.11, magic link is NOT a prop on `AuthView`. Instead:

1. **Separate View**: Magic link has its own view at `/auth/magic-link`
2. **Auto-Detection**: The `AuthView` component queries `/api/auth` to detect available methods
3. **Dynamic UI**: If magic link is detected, a link/button appears on the sign-in form

## Required Steps to Enable Magic Link

### 1. Ensure Environment Variables Are Set

Create `.env.local` in the `apps/bru-grappling` directory:

```bash
# Server URL (required)
NEXT_PUBLIC_SERVER_URL=http://localhost:3000

# Better Auth URL (optional, falls back to SERVER_URL)
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000

# Better Auth Secret (required for production)
BETTER_AUTH_SECRET=your-secret-key-here

# Google OAuth (if using)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Database
DATABASE_URI=postgres://postgres:brugrappling@localhost:5432/bru_grappling

# Payload
PAYLOAD_SECRET=your-payload-secret
```

### 2. Restart the Dev Server

After setting environment variables:

```bash
cd apps/bru-grappling
pnpm dev
```

### 3. Verify the Auth API is Working

Test the Better Auth API endpoint:

```bash
curl http://localhost:3000/api/auth/session
```

Should return either session data or empty response (not an error).

### 4. Check Browser Console

Open `/auth/sign-in` and check the browser console for:
- Network requests to `/api/auth`
- Any errors related to auth configuration
- Whether the magic link option appears after the page loads

## Testing Magic Link

### Option 1: Direct URL
Navigate directly to: `http://localhost:3000/auth/magic-link`

This should show a form where you can enter your email to receive a magic link.

### Option 2: Sign-In Form
1. Go to `http://localhost:3000/auth/sign-in`
2. Look for a "Use magic link" or "Email me a login link" button/link
3. If it doesn't appear, the `AuthView` component isn't detecting the plugin

## Common Issues

### Issue: Magic link option doesn't appear on sign-in form

**Possible Causes:**
1. Environment variables not set (restart required)
2. Better Auth API not responding correctly
3. Plugin not properly initialized on server
4. Client can't reach the auth API endpoint

**Debug Steps:**
1. Check browser Network tab for requests to `/api/auth`
2. Look for any 404 or 500 errors
3. Verify environment variables are loaded: `console.log(process.env.NEXT_PUBLIC_SERVER_URL)`
4. Check server logs for Better Auth initialization messages

### Issue: "Route not found" when accessing `/api/auth`

This is expected! The route is `/api/auth/[...all]`, not `/api/auth`.

Try: `curl http://localhost:3000/api/auth/session`

### Issue: Magic link form shows but doesn't send email

Expected behavior in development! The `sendMagicLink` callback just logs to console:

```typescript
magicLink({
  sendMagicLink: async ({ email, token, url }, request) => {
    console.log('Send magic link for user: ', email, token, url)
  },
})
```

To actually send emails, integrate with an email service (Resend, SendGrid, etc.).

## Next Steps

If magic link still doesn't appear after following this guide:

1. **Check the Better Auth UI version**: Ensure you're on v3.2.11 or later
2. **Verify plugin exports**: Make sure the magic link plugin is properly exported from Better Auth
3. **Test with minimal config**: Try removing other plugins to see if there's a conflict
4. **Check for type errors**: Run `pnpm build` to see if there are any TypeScript errors

## Alternative: Use Direct Magic Link Route

Instead of relying on auto-detection, you can add a manual link on your sign-in page:

```tsx
<Link href="/auth/magic-link" className="text-sm text-primary hover:underline">
  Sign in with magic link instead
</Link>
```

This bypasses the auto-detection and gives users direct access to the magic link form.

