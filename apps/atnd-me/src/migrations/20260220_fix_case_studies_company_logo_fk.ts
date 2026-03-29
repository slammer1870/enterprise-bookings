import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Align constraints with Payload schema push expectations:
 *
 * 1) Case studies (main table): Payload tries to ADD
 *    "pages_blocks_case_studies_case_studies_company_logo_id_media_id_fk" but the DB
 *    already has a constraint (e.g. truncated "pages_blocks_case_studies_case_studies_company_logo_id_media_id").
 *    Drop any existing FK on company_logo_id so Payload can add it.
 *
 * 2) Case studies (versioned table): Payload tries to DROP
 *    "_pages_v_blocks_case_studies_case_studies_company_logo_id_media" (truncated). Rename
 *    the existing FK to that name so the DROP succeeds; then Payload will ADD the new one.
 *
 * 3) Tenant scoped schedule (versioned): Same idea - rename FK so Payload's DROP succeeds.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1) Drop any FK on public.pages_blocks_case_studies_case_studies.company_logo_id
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

  // 2) Versioned case_studies: RENAME company_logo FK to the name Payload will DROP (truncated), so DROP succeeds
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
        WHERE t.relname = '_pages_v_blocks_case_studies_case_studies'
          AND c.contype = 'f'
          AND c.conname <> '_pages_v_blocks_case_studies_case_studies_company_logo_id_media'
          AND EXISTS (
            SELECT 1 FROM pg_attribute a
            WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) AND NOT a.attisdropped
            AND a.attname = 'company_logo_id'
          )
      LOOP
        EXECUTE format('ALTER TABLE public._pages_v_blocks_case_studies_case_studies RENAME CONSTRAINT %I TO %I', r.conname, '_pages_v_blocks_case_studies_case_studies_company_logo_id_media');
        EXIT;
      END LOOP;
    END $$;
  `)

  // 3) Rename versioned tenant_scoped_schedule FK so Payload's DROP CONSTRAINT (truncated name) succeeds.
  // Only rename when the _fk constraint exists and the target name does not (avoid "already exists").
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
        WHERE t.relname = '_pages_v_blocks_tenant_scoped_schedule'
          AND c.conname = '_pages_v_blocks_tenant_scoped_schedule_default_tenant_id_tenants_id_fk'
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
        WHERE t.relname = '_pages_v_blocks_tenant_scoped_schedule'
          AND c.conname = '_pages_v_blocks_tenant_scoped_schedule_default_tenant_id_tenant'
      ) THEN
        ALTER TABLE public._pages_v_blocks_tenant_scoped_schedule
        RENAME CONSTRAINT "_pages_v_blocks_tenant_scoped_schedule_default_tenant_id_tenants_id_fk"
        TO "_pages_v_blocks_tenant_scoped_schedule_default_tenant_id_tenant";
      END IF;
    END $$;
  `)
}

export async function down({ db: _db }: MigrateDownArgs): Promise<void> {
  // No-op: Payload's schema push will recreate the constraint on next run
}
