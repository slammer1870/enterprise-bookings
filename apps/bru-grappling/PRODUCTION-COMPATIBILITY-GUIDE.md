# Production Compatibility Guide

## Current Status

✅ **Database Reset Complete**: Your local database is now clean and ready for fresh migrations

## Next Steps (Run these commands)

### 1. Create Initial Migration
```bash
cd apps/bru-grappling
pnpm payload migrate:create
```

**When prompted**: Select `+ enum_users_role create enum` (first option, press Enter)

This will create a migration file in `src/migrations/` with a timestamp.

### 2. Apply the Migration
```bash
pnpm payload migrate
```

This applies the migration to your local database and creates all tables with the correct structure.

### 3. Start Development Server
```bash
pnpm dev
```

Visit http://localhost:3000/admin and create your first admin user.

## For Production Deployment

### Option A: If Production Database is Empty
Simply run migrations before starting:
```bash
pnpm payload migrate
pnpm build
pnpm start
```

### Option B: If Production Database Has Old Schema
You need to migrate the existing data. Two approaches:

**Approach 1: Generate Migration from Existing Data**
1. On production, backup the database:
   ```bash
   pg_dump $DATABASE_URI > backup_before_migration.sql
   ```

2. Run the migration (it will handle the schema changes):
   ```bash
   pnpm payload migrate
   ```

**Approach 2: Use `sync-from-production.sh`** script
If production already has better-auth:
```bash
export PRODUCTION_DATABASE_URI='postgres://user:pass@host:5432/dbname'
./sync-from-production.sh
```

## Maintaining Compatibility

### Golden Rule
**Always use migrations for production**, never use dev mode's auto-push.

### Workflow
1. **Local Development**: 
   - Make schema changes in code
   - Run `pnpm payload migrate:create` to generate migration
   - Test locally with `pnpm payload migrate`

2. **Commit Migration Files**:
   ```bash
   git add src/migrations/
   git commit -m "Add migration for better-auth schema"
   ```

3. **Production Deployment**:
   - Pull latest code
   - Run `pnpm payload migrate` before starting the app
   - Migrations run automatically in sequence

### Important Files
- `/src/migrations/` - All your migration files
- Keep `.ts` and `.json` files together
- Never edit migrations after they've run in production

## Troubleshooting

### "Migration already exists"
Delete the incomplete migration files and run `migrate:create` again.

### "enum_users_role already exists"  
Database isn't clean. Re-run:
```bash
psql $DATABASE_URI -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
pnpm payload migrate:create
```

### "column doesn't exist"
Migration didn't run. Run:
```bash
pnpm payload migrate
```

## What Changed in Better-Auth Migration

Your better-auth setup changes the schema:

**Users Table**:
- Added: `email_verified`, `role`, `banned`, `ban_reason`, `ban_expires`
- Renamed: `image_id` → `image`
- Changed: `role` from many-to-many table to enum column

**New Tables**:
- `accounts` - OAuth/social login accounts
- `sessions` - User sessions
- `verifications` - Email verification tokens
- `instructors` - Instructor profiles (linked to users)
- `users_sessions` - Active device sessions
- `payload_kv` - Key-value store

**Removed**:
- `users_roles` table (replaced by `role` enum column)

## Production Checklist

Before deploying to production with better-auth:

- [ ] Environment variables set (`BETTER_AUTH_SECRET`, `DATABASE_URI`, etc.)
- [ ] Migrations tested locally
- [ ] Backup production database
- [ ] Run `pnpm payload migrate` in production
- [ ] Test authentication flow
- [ ] Verify existing users can still log in
- [ ] Check admin access works

## Support Scripts

Three helper scripts are available:

1. **`migration-workflow.md`** - Detailed migration guide
2. **`sync-from-production.sh`** - Pull production schema to local
3. **`PRODUCTION-COMPATIBILITY-GUIDE.md`** - This file

## Questions?

Common scenarios:

**"How do I sync my local dev with production?"**
```bash
export PRODUCTION_DATABASE_URI='...'
./sync-from-production.sh
```

**"I made schema changes, how do I deploy them?"**
```bash
pnpm payload migrate:create  # Generates migration
pnpm payload migrate         # Test locally
git add src/migrations/ && git commit
# Deploy to production (migrations run automatically)
```

**"Can I use dev mode locally?"**
Yes, but don't use it for production. Dev mode auto-pushes schema changes without tracking them in migrations.

