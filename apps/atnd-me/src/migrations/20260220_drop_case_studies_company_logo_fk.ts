import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Drop the company_logo FK on pages_blocks_case_studies_case_studies by looking up
 * the actual constraint name. Ensures Payload's schema push (ADD ..._fk) can succeed
 * even if a prior migration already ran or the constraint name differs.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
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
  // No-op
}
