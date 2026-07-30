import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Backfill denormalized `adminTitle` for existing timeslots.
 *
 * Relationship pickers use the stored useAsTitle value and do not run afterRead
 * fallbacks when the title field is null, so legacy rows show "Untitled - ID: …".
 * Format matches `formatTimeslotAdminTitle` (Europe/Dublin default).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Join via derived table: Postgres forbids referencing the UPDATE target
  // alias in a FROM/JOIN ON clause (`invalid reference to FROM-clause entry`).
  await db.execute(sql`
    UPDATE "timeslots" AS ts
    SET "admin_title" = src."admin_title"
    FROM (
      SELECT
        ts2.id,
        (
          initcap(to_char(ts2.start_time AT TIME ZONE COALESCE(NULLIF(l.time_zone, ''), NULLIF(t.time_zone, ''), 'Europe/Dublin'), 'Dy'))
          || ' '
          || to_char(ts2.start_time AT TIME ZONE COALESCE(NULLIF(l.time_zone, ''), NULLIF(t.time_zone, ''), 'Europe/Dublin'), 'FMDD Mon YYYY')
          || ' · '
          || trim(to_char(ts2.start_time AT TIME ZONE COALESCE(NULLIF(l.time_zone, ''), NULLIF(t.time_zone, ''), 'Europe/Dublin'), 'FMHH12:MI AM'))
          || ' – '
          || trim(to_char(ts2.end_time AT TIME ZONE COALESCE(NULLIF(l.time_zone, ''), NULLIF(t.time_zone, ''), 'Europe/Dublin'), 'FMHH12:MI AM'))
        ) AS "admin_title"
      FROM "timeslots" AS ts2
      INNER JOIN "tenants" AS t ON t.id = ts2.tenant_id
      LEFT JOIN "locations" AS l ON l.id = ts2.branch_id
      WHERE (ts2.admin_title IS NULL OR btrim(ts2.admin_title) = '')
        AND ts2.start_time IS NOT NULL
        AND ts2.end_time IS NOT NULL
    ) AS src
    WHERE ts.id = src.id
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
      AND ts.end_time IS NOT NULL
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Non-destructive: leave titles in place (they remain valid labels).
}
