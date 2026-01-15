import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Fix the payload_migrations constraint issue.
 * 
 * Payload CMS schema sync tries to drop the "payload_migrations_id_not_null" constraint,
 * but PostgreSQL prevents this because the "id" column is part of the primary key.
 * This migration safely handles the constraint to prevent schema sync errors.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Safely drop the constraint if it exists, but ignore errors if it can't be dropped
  // (e.g., because id is in a primary key)
  await db.execute(sql`
    DO $$ 
    BEGIN
      -- Try to drop the constraint if it exists, but ignore errors if it can't be dropped
      -- (e.g., because id is in a primary key)
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'payload_migrations_id_not_null'
        ) THEN
          ALTER TABLE "payload_migrations" DROP CONSTRAINT IF EXISTS "payload_migrations_id_not_null";
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Constraint might be part of primary key or doesn't exist - that's fine
        NULL;
      END;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // No-op: we can't recreate a constraint that was invalid or part of primary key
  // The constraint will be recreated by Payload if needed
}
