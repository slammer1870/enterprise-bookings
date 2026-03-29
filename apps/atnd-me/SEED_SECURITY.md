# Seed Endpoint Security

This document describes the security measures in place to protect the seed endpoint in production environments.

## Production Protections

### 1. Environment Check
The seed endpoint is **completely disabled in production**. It will return a 403 error if accessed when `NODE_ENV=production`.

### 2. Authentication Required
- User must be authenticated (logged in)
- User must have `admin` role

### 3. Optional Secret Token
For additional security (even in staging), you can set a `SEED_SECRET` environment variable. If set, the endpoint will require this secret to be passed in the `x-seed-secret` header.

```bash
# Set in your .env file
SEED_SECRET=your-super-secret-token-here
```

Then when calling the endpoint:
```bash
curl -X POST http://localhost:3000/api/seed \
  -H "Cookie: payload-token=YOUR_TOKEN" \
  -H "x-seed-secret: your-super-secret-token-here"
```

### 4. Logging
All seed operations are logged with:
- User email
- Environment
- Timestamp
- Success/failure status

## Standalone Script Protection

The standalone seed script (`pnpm seed`) also includes production protection:
- Checks `NODE_ENV` and exits if production
- Requires admin user to exist
- Shows warning and 3-second delay before proceeding
- Verifies user has admin role

## Recommended Production Setup

### 1. Environment Variables
```bash
# Production .env
NODE_ENV=production
SEED_SECRET=  # Leave empty or don't set - endpoint will be disabled anyway
```

### 2. Remove Seed Button from Admin UI (Optional)
If you want to completely hide the seed functionality in production, you can conditionally render the seed button:

```tsx
// In your BeforeDashboard component
{process.env.NODE_ENV !== 'production' && <SeedButton />}
```

### 3. Network-Level Protection
Consider adding additional network-level protections:
- IP whitelisting for admin endpoints
- Rate limiting
- WAF rules to block seed endpoint in production

## Testing Security

To verify the protections work:

1. **Test Production Block**:
   ```bash
   NODE_ENV=production pnpm seed
   # Should exit with error
   ```

2. **Test Admin Requirement**:
   - Try accessing `/api/seed` as a non-admin user
   - Should return 403

3. **Test Secret Token** (if enabled):
   ```bash
   SEED_SECRET=test-secret curl -X POST http://localhost:3000/api/seed \
     -H "Cookie: payload-token=TOKEN" \
     # Should fail without x-seed-secret header
   ```

## Best Practices

1. **Never enable seed in production** - The endpoint is hardcoded to reject production requests
2. **Use staging environment** - Test seeding in a staging environment that mirrors production
3. **Monitor logs** - Check logs for any seed attempts in production (should never happen)
4. **Rotate secrets** - If using `SEED_SECRET`, rotate it regularly
5. **Limit access** - Only give admin access to trusted users
6. **Backup before seeding** - Always backup your database before running seed in staging

## Incident Response

If seed is accidentally run in production:

1. **Immediately** check database state
2. **Restore from backup** if data was corrupted
3. **Review logs** to see what was seeded
4. **Review access logs** to identify who accessed the endpoint
5. **Update security** if needed (e.g., add IP whitelisting)

## Additional Hardening (Optional)

For maximum security, you can:

1. **Remove the route entirely in production builds**:
   ```typescript
   // In next.config.js
   if (process.env.NODE_ENV === 'production') {
     // Remove seed route from build
   }
   ```

2. **Use feature flags**:
   ```bash
   ENABLE_SEED_ENDPOINT=false  # In production
   ```

3. **Add IP whitelisting middleware**:
   ```typescript
   const allowedIPs = process.env.SEED_ALLOWED_IPS?.split(',') || []
   if (!allowedIPs.includes(clientIP)) {
     return new Response('Forbidden', { status: 403 })
   }
   ```
