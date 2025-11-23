# Migration Workflow for Production Compatibility

## Prerequisites
Ensure these are set in your `.env`:
```bash
DATABASE_URI=postgres://postgres:brugrappling@localhost:5432/bru_grappling
PAYLOAD_SECRET=your-secret
```

## Workflow

### 1. Clean Database State
Start with a fresh local database:
```bash
# Drop and recreate local database
psql postgres://postgres:brugrappling@localhost:5432/postgres -c "DROP DATABASE IF EXISTS bru_grappling;"
psql postgres://postgres:brugrappling@localhost:5432/postgres -c "CREATE DATABASE bru_grappling;"

# Drop public schema (if database already has tables)
psql postgres://postgres:brugrappling@localhost:5432/bru_grappling -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

### 2. Clear Old Migrations
Remove any partial/broken migrations:
```bash
cd src/migrations
# Keep only the migrations that are in production, delete others
# Or delete all if starting fresh
rm -f 20251122_132232.ts 20251123_131139.json
```

### 3. Generate Migration from Current Schema
```bash
pnpm payload migrate:create
```

This will:
- Compare your Payload config schema with the database
- Generate a migration file in `src/migrations/`
- Create both `.ts` and `.json` files

### 4. Run Migration
```bash
pnpm payload migrate
```

### 5. Test Locally
```bash
pnpm dev
# Visit http://localhost:3000/admin
# Create a test user with email/password
```

### 6. Deploy to Production
Ensure your production deployment runs migrations:

**Option A: Manual deployment**
```bash
# SSH into production
pnpm payload migrate
pnpm build
pnpm start
```

**Option B: In deployment script/Dockerfile**
```bash
# Add to your startup script
pnpm payload migrate && pnpm start
```

**Option C: Railway/Vercel/etc.**
Add to build command:
```
pnpm payload migrate && pnpm build
```

## Important Notes

### ⚠️ Never Mix Dev Mode with Migrations
- **Dev mode** (`pnpm dev`): Automatically pushes schema changes (no migrations)
- **Migrations**: Explicitly track and version schema changes

**Choose one approach:**
- **Local dev**: Use dev mode (auto-push)
- **Production**: Use migrations only

### Keeping in Sync

If you use dev mode locally and want to sync with production:

1. **Generate migration from dev changes:**
   ```bash
   pnpm payload migrate:create
   ```

2. **Test the migration:**
   ```bash
   # Fresh database
   dropdb bru_grappling && createdb bru_grappling
   pnpm payload migrate
   pnpm dev
   ```

3. **Deploy the migration to production**

### Current Better-Auth Schema Changes

Your better-auth setup adds:
- `email_verified`, `role`, `banned`, `ban_reason`, `ban_expires` columns to `users`
- `accounts`, `sessions`, `verifications`, `instructors` tables
- `users_sessions` array table
- Renames `image_id` to `image` column
- Changes `role` from many-to-many table to enum column

## Troubleshooting

### "enum_users_role already exists"
Database has mixed state. Solution:
```bash
dropdb bru_grappling && createdb bru_grappling
rm src/migrations/20251123_131139.* # Remove broken migration
pnpm payload migrate:create
pnpm payload migrate
```

### "column role does not exist"
Migration hasn't run. Solution:
```bash
pnpm payload migrate
```

### Tables exist but wrong structure
Database out of sync. Solution:
```bash
# Backup first!
pg_dump DATABASE_URI > backup.sql

# Then:
DROP SCHEMA public CASCADE; CREATE SCHEMA public;
pnpm payload migrate
```

