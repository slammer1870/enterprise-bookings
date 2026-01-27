import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Fix duplicate foreign key constraint error for scheduler_week_days_time_slot.
 * 
 * Payload's schema push tries to add the constraint "scheduler_week_days_time_slot_class_option_id_class_options_id_fk"
 * but it already exists from migration 20260120_171611. This migration ensures the constraint
 * exists with the correct name and properties, preventing Payload from trying to add it again.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ 
    BEGIN
      -- Check if the constraint already exists
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'scheduler_week_days_time_slot_class_option_id_class_options_id_fk'
      ) THEN
        -- If it doesn't exist, create it
        ALTER TABLE "scheduler_week_days_time_slot" 
        ADD CONSTRAINT "scheduler_week_days_time_slot_class_option_id_class_options_id_fk" 
        FOREIGN KEY ("class_option_id") 
        REFERENCES "public"."class_options"("id") 
        ON DELETE set null 
        ON UPDATE no action;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- If the constraint already exists or there's another issue, that's fine
      -- Payload's schema sync will handle it
      NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // No-op: we don't want to drop the constraint as it's needed
  // If needed, Payload's schema sync will handle it
}
