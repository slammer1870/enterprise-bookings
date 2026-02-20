import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Align constraint names with Payload schema push (truncated names):
 *
 * 1) scheduler_week_days_time_slot: Payload DROPs "scheduler_week_days_time_slot_class_option_id_class_options_id_"
 *    but the DB may have "..._id_fk". Rename to the truncated name so DROP succeeds; then Payload ADDs the _fk one.
 *
 * 2) pages_blocks_case_studies_case_studies: Payload ADDs "..._company_logo_id_media_id_fk" but DB has
 *    "..._company_logo_id_media_id". Drop by exact name(s) so ADD can succeed.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1) Scheduler: rename class_option_id FK to the name Payload will DROP (63-char truncated)
  await db.execute(sql`
    DO $$
    DECLARE
      r RECORD;
      target_name text := 'scheduler_week_days_time_slot_class_option_id_class_options_id_';
    BEGIN
      FOR r IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
        WHERE t.relname = 'scheduler_week_days_time_slot'
          AND c.contype = 'f'
          AND c.conname <> target_name
          AND EXISTS (
            SELECT 1 FROM pg_attribute a
            WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) AND NOT a.attisdropped
            AND a.attname = 'class_option_id'
          )
      LOOP
        EXECUTE format('ALTER TABLE public.scheduler_week_days_time_slot RENAME CONSTRAINT %I TO %I', r.conname, target_name);
        EXIT;
      END LOOP;
    END $$;
  `)

  // 2) Case studies main table: drop any FK on company_logo_id (by lookup so we always get the real name)
  await db.execute(sql`
    DO $$
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
        WHERE t.relname = 'pages_blocks_case_studies_case_studies'
          AND c.contype = 'f'
          AND EXISTS (
            SELECT 1 FROM pg_attribute a
            WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) AND NOT a.attisdropped
            AND a.attname = 'company_logo_id'
          )
      LOOP
        EXECUTE format('ALTER TABLE public.pages_blocks_case_studies_case_studies DROP CONSTRAINT IF EXISTS %I', r.conname);
      END LOOP;
    END $$;
  `)
}

export async function down({ db: _db }: MigrateDownArgs): Promise<void> {
  // No-op: Payload schema push will recreate as needed
}
