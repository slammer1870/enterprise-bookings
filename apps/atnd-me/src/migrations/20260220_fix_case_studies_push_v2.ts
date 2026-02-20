import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Follow-up for schema push: if the versioned case_studies table has no company_logo FK
 * (e.g. previous migration dropped it), Payload's DROP "_pages_v_blocks_case_studies_case_studies_company_logo_id_media"
 * fails. Add a constraint with that exact name so the DROP succeeds and Payload can then ADD the correct one.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '_pages_v_blocks_case_studies_case_studies')
        AND NOT EXISTS (
          SELECT 1 FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
          WHERE t.relname = '_pages_v_blocks_case_studies_case_studies'
            AND c.contype = 'f'
            AND EXISTS (
              SELECT 1 FROM pg_attribute a
              WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) AND NOT a.attisdropped
              AND a.attname = 'company_logo_id'
            )
        )
      THEN
        ALTER TABLE public._pages_v_blocks_case_studies_case_studies
        ADD CONSTRAINT "_pages_v_blocks_case_studies_case_studies_company_logo_id_media"
        FOREIGN KEY (company_logo_id) REFERENCES public.media(id) ON DELETE SET NULL ON UPDATE NO ACTION;
      END IF;
    END $$;
  `)
}

export async function down({ db: _db }: MigrateDownArgs): Promise<void> {
  // No-op
}
