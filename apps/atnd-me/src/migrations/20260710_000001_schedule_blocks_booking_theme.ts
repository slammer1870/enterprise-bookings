import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

const BOOKING_THEME_COLUMNS = [
  'booking_theme_checkin_background_color',
  'booking_theme_checkin_foreground_color',
  'booking_theme_trialable_background_color',
  'booking_theme_trialable_foreground_color',
  'booking_theme_cancel_background_color',
  'booking_theme_cancel_foreground_color',
  'booking_theme_waitlist_background_color',
  'booking_theme_waitlist_foreground_color',
  'booking_theme_children_booked_background_color',
  'booking_theme_children_booked_foreground_color',
  'booking_theme_modify_background_color',
  'booking_theme_modify_foreground_color',
  'booking_theme_closed_background_color',
  'booking_theme_closed_foreground_color',
] as const

const SCHEDULE_BLOCK_TABLES = [
  'pages_blocks_schedule',
  '_pages_v_blocks_schedule',
  'hero_sched_sanc',
  '_hero_sched_sanc_v',
  'pages_blocks_hero_with_location',
  '_pages_v_blocks_hero_with_location',
  'pages_blocks_cl_hero_loc',
  '_pages_v_blocks_cl_hero_loc',
  'pages_blocks_tenant_scoped_schedule',
  '_pages_v_blocks_tenant_scoped_schedule',
  'pages_blocks_dh_live_schedule',
  '_pages_v_blocks_dh_live_schedule',
] as const

function addBookingThemeColumns(table: string): string {
  return BOOKING_THEME_COLUMNS.map(
    (col) => `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col}" varchar;`,
  ).join('\n    ')
}

function copyThemeFromTenantToBlocks(blockTable: string, parentTable: string, tenantJoinColumn: string): string {
  const setClause = BOOKING_THEME_COLUMNS.map((col) => `"${col}" = t."${col}"`).join(',\n      ')

  return `
    UPDATE "${blockTable}" b
    SET
      ${setClause}
    FROM "${parentTable}" p
    JOIN "tenants" t ON p."${tenantJoinColumn}" = t.id
    WHERE b."_parent_id" = p.id;
  `
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const table of SCHEDULE_BLOCK_TABLES) {
    await db.execute(sql.raw(addBookingThemeColumns(table)))
  }

  const liveCopies = [
    copyThemeFromTenantToBlocks('pages_blocks_schedule', 'pages', 'tenant_id'),
    copyThemeFromTenantToBlocks('hero_sched_sanc', 'pages', 'tenant_id'),
    copyThemeFromTenantToBlocks('pages_blocks_hero_with_location', 'pages', 'tenant_id'),
    copyThemeFromTenantToBlocks('pages_blocks_cl_hero_loc', 'pages', 'tenant_id'),
    copyThemeFromTenantToBlocks('pages_blocks_tenant_scoped_schedule', 'pages', 'tenant_id'),
    copyThemeFromTenantToBlocks('pages_blocks_dh_live_schedule', 'pages', 'tenant_id'),
  ]

  for (const statement of liveCopies) {
    await db.execute(sql.raw(statement))
  }

  const versionCopies = [
    copyThemeFromTenantToBlocks('_pages_v_blocks_schedule', '_pages_v', 'version_tenant_id'),
    copyThemeFromTenantToBlocks('_hero_sched_sanc_v', '_pages_v', 'version_tenant_id'),
    copyThemeFromTenantToBlocks('_pages_v_blocks_hero_with_location', '_pages_v', 'version_tenant_id'),
    copyThemeFromTenantToBlocks('_pages_v_blocks_cl_hero_loc', '_pages_v', 'version_tenant_id'),
    copyThemeFromTenantToBlocks('_pages_v_blocks_tenant_scoped_schedule', '_pages_v', 'version_tenant_id'),
    copyThemeFromTenantToBlocks('_pages_v_blocks_dh_live_schedule', '_pages_v', 'version_tenant_id'),
  ]

  for (const statement of versionCopies) {
    await db.execute(sql.raw(statement))
  }

  for (const col of BOOKING_THEME_COLUMNS) {
    await db.execute(sql.raw(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "${col}";`))
  }
}

function dropBookingThemeColumns(table: string): string {
  return BOOKING_THEME_COLUMNS.map((col) => `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${col}";`).join(
    '\n    ',
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const col of BOOKING_THEME_COLUMNS) {
    await db.execute(sql.raw(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "${col}" varchar;`))
  }

  for (const table of SCHEDULE_BLOCK_TABLES) {
    await db.execute(sql.raw(dropBookingThemeColumns(table)))
  }
}
