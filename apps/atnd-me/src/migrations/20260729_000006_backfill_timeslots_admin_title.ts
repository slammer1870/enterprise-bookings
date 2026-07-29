import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Backfill denormalized `adminTitle` for existing timeslots.
 *
 * Relationship pickers use the stored useAsTitle value and do not run afterRead
 * fallbacks when the title field is null, so legacy rows show "Untitled - ID: …".
 * Format matches `formatTimeslotAdminTitle` (Europe/Dublin default).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "timeslots" AS ts
    SET "admin_title" = (
      initcap(to_char(ts.start_time AT TIME ZONE COALESCE(NULLIF(l.time_zone, ''), NULLIF(t.time_zone, ''), 'Europe/Dublin'), 'Dy'))
      || ' '
      || to_char(ts.start_time AT TIME ZONE COALESCE(NULLIF(l.time_zone, ''), NULLIF(t.time_zone, ''), 'Europe/Dublin'), 'FMDD Mon YYYY')
      || ' · '
      || trim(to_char(ts.start_time AT TIME ZONE COALESCE(NULLIF(l.time_zone, ''), NULLIF(t.time_zone, ''), 'Europe/Dublin'), 'FMHH12:MI AM'))
      || ' – '
      || trim(to_char(ts.end_time AT TIME ZONE COALESCE(NULLIF(l.time_zone, ''), NULLIF(t.time_zone, ''), 'Europe/Dublin'), 'FMHH12:MI AM'))
    )
    FROM "tenants" AS t
    LEFT JOIN "locations" AS l ON l.id = ts.branch_id
    WHERE t.id = ts.tenant_id
      AND (ts.admin_title IS NULL OR btrim(ts.admin_title) = '')
      AND ts.start_time IS NOT NULL
      AND ts.end_time IS NOT NULL;
  `)

  // Timeslots without a tenant still need a label (default Europe/Dublin).
  await db.execute(sql`
    UPDATE "timeslots" AS ts
    SET "admin_title" = (
      initcap(to_char(ts.start_time AT TIME ZONE 'Europe/Dublin', 'Dy'))
      || ' '
      || to_char(ts.start_time AT TIME ZONE 'Europe/Dublin', 'FMDD Mon YYYY')
      || ' · '
      || trim(to_char(ts.start_time AT TIME ZONE 'Europe/Dublin', 'FMHH12:MI AM'))
      || ' – '
      || trim(to_char(ts.end_time AT TIME ZONE 'Europe/Dublin', 'FMHH12:MI AM'))
    )
    WHERE (ts.admin_title IS NULL OR btrim(ts.admin_title) = '')
      AND ts.start_time IS NOT NULL
      AND ts.end_time IS NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Non-destructive: leave titles in place (they remain valid labels).
  await db.execute(sql`SELECT 1`)
}
