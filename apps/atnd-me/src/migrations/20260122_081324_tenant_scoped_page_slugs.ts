import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Make page slugs unique per tenant instead of globally unique.
 * 
 * This migration:
 * 1. Drops the global unique index on pages.slug
 * 2. Creates a composite unique index on (tenant_id, slug) for pages
 * 3. Handles the version table _pages_v similarly
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Drop the global unique index on pages.slug
    DROP INDEX IF EXISTS "pages_slug_idx";
    
    -- Create composite unique index for pages (tenant_id, slug)
    -- This allows the same slug to exist for different tenants
    CREATE UNIQUE INDEX "pages_tenant_slug_idx" ON "pages" USING btree ("tenant_id", "slug");
    
    -- Also handle the version table if it has a slug index
    -- Note: The version table uses version_slug, not slug
    -- We check if there's a unique constraint on version_slug and handle it if needed
    DO $$ 
    BEGIN
      -- Check if there's a unique index on version_slug in _pages_v
      IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = '_pages_v' 
        AND indexname LIKE '%version_slug%'
        AND indexdef LIKE '%UNIQUE%'
      ) THEN
        -- Drop any existing unique index on version_slug
        EXECUTE (
          SELECT 'DROP INDEX IF EXISTS "' || indexname || '";'
          FROM pg_indexes 
          WHERE tablename = '_pages_v' 
          AND indexname LIKE '%version_slug%'
          AND indexdef LIKE '%UNIQUE%'
          LIMIT 1
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- If there's no such index or other error, continue
      NULL;
    END $$;
    
    -- Create composite unique index for version table (version_tenant_id, version_slug)
    -- This ensures draft versions also respect tenant-scoped slug uniqueness
    CREATE UNIQUE INDEX IF NOT EXISTS "_pages_v_tenant_version_slug_idx" 
    ON "_pages_v" USING btree ("version_tenant_id", "version_slug")
    WHERE "version_tenant_id" IS NOT NULL;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Drop the composite unique indexes
    DROP INDEX IF EXISTS "pages_tenant_slug_idx";
    DROP INDEX IF EXISTS "_pages_v_tenant_version_slug_idx";
    
    -- Restore the global unique index on pages.slug
    CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
    
    -- Restore unique index on version_slug if it existed
    -- Note: We can't perfectly restore the original state, but we create a simple unique index
    CREATE UNIQUE INDEX IF NOT EXISTS "_pages_v_version_version_slug_idx" 
    ON "_pages_v" USING btree ("version_slug");
  `)
}
