import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Fix the payload_kv constraint issue - safely drop the constraint if it exists
  // This constraint cannot be dropped because id is part of the primary key
  // Payload tries to drop it during schema sync, but PostgreSQL prevents it
  await db.execute(sql`
    DO $$ 
    BEGIN
      -- Try to drop the constraint if it exists, but ignore errors if it can't be dropped
      -- (e.g., because id is in a primary key)
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'payload_kv_id_not_null'
        ) THEN
          ALTER TABLE "payload_kv" DROP CONSTRAINT IF EXISTS "payload_kv_id_not_null";
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Constraint might be part of primary key or doesn't exist - that's fine
        NULL;
      END;
    END $$;
  `)
}

// eslint-disable-next-line no-unused-vars -- required by MigrateDownArgs signature
export async function down(_args: MigrateDownArgs): Promise<void> {
  // No-op: we can't recreate a constraint that was invalid
}

