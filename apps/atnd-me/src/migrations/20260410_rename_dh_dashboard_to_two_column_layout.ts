import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Rename `dhDashboardLayout` → generic `twoColumnLayout` (same role as `threeColumnLayout`).
 * - Tenant allowed-blocks enum + join rows
 * - Block tables + headings columns (`schedule_*` / `membership_*` → `left_*` / `right_*`)
 * - `_path` / `path` strings for nested blocks (`scheduleBlocks` / `membershipBlocks` → `leftBlocks` / `rightBlocks`)
 *
 * Leaves enum value `dhDashboardLayout` on the type (Postgres cannot drop enum values safely).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE IF NOT EXISTS 'twoColumnLayout' BEFORE 'threeColumnLayout';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    UPDATE "tenants_allowed_blocks"
    SET "value" = 'twoColumnLayout'::"public"."enum_tenants_allowed_blocks"
    WHERE "value"::text = 'dhDashboardLayout';
  `)

  await db.execute(sql`
    DO $$
    DECLARE
      r record;
    BEGIN
      FOR r IN
        SELECT table_schema, table_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = '_path'
      LOOP
        EXECUTE format(
          'UPDATE %I.%I SET "_path" = replace(replace(replace("_path", %L, %L), %L, %L), %L, %L) WHERE "_path" LIKE %L OR "_path" LIKE %L OR "_path" LIKE %L',
          r.table_schema,
          r.table_name,
          'scheduleBlocks',
          'leftBlocks',
          'membershipBlocks',
          'rightBlocks',
          'dhDashboardLayout',
          'twoColumnLayout',
          '%scheduleBlocks%',
          '%membershipBlocks%',
          '%dhDashboardLayout%'
        );
      END LOOP;
    END $$;
  `)

  await db.execute(sql`
    UPDATE "pages_rels"
    SET "path" = replace(replace(replace("path", 'scheduleBlocks', 'leftBlocks'), 'membershipBlocks', 'rightBlocks'), 'dhDashboardLayout', 'twoColumnLayout')
    WHERE "path" LIKE '%scheduleBlocks%' OR "path" LIKE '%membershipBlocks%' OR "path" LIKE '%dhDashboardLayout%';
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'pages_blocks_dh_dashboard_layout'
      ) THEN
        ALTER TABLE "public"."pages_blocks_dh_dashboard_layout" RENAME TO "pages_blocks_two_column_layout";
        ALTER TABLE "public"."pages_blocks_two_column_layout" RENAME COLUMN "schedule_heading" TO "left_column_heading";
        ALTER TABLE "public"."pages_blocks_two_column_layout" RENAME COLUMN "membership_heading" TO "right_column_heading";
        ALTER TABLE "public"."pages_blocks_two_column_layout" ALTER COLUMN "left_column_heading" SET DEFAULT 'Column one';
        ALTER TABLE "public"."pages_blocks_two_column_layout" ALTER COLUMN "right_column_heading" SET DEFAULT 'Column two';
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'pages_blocks_two_column_layout'
          AND constraint_name = 'pages_blocks_dh_dashboard_layout_parent_id_fk'
      ) THEN
        ALTER TABLE "public"."pages_blocks_two_column_layout"
          RENAME CONSTRAINT "pages_blocks_dh_dashboard_layout_parent_id_fk" TO "pages_blocks_two_column_layout_parent_id_fk";
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'pages_blocks_dh_dashboard_layout_order_idx') THEN
        ALTER INDEX "pages_blocks_dh_dashboard_layout_order_idx" RENAME TO "pages_blocks_two_column_layout_order_idx";
      END IF;
      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'pages_blocks_dh_dashboard_layout_parent_id_idx') THEN
        ALTER INDEX "pages_blocks_dh_dashboard_layout_parent_id_idx" RENAME TO "pages_blocks_two_column_layout_parent_id_idx";
      END IF;
      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'pages_blocks_dh_dashboard_layout_path_idx') THEN
        ALTER INDEX "pages_blocks_dh_dashboard_layout_path_idx" RENAME TO "pages_blocks_two_column_layout_path_idx";
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = '_pages_v_blocks_dh_dashboard_layout'
      ) THEN
        ALTER TABLE "public"."_pages_v_blocks_dh_dashboard_layout" RENAME TO "_pages_v_blocks_two_column_layout";
        ALTER TABLE "public"."_pages_v_blocks_two_column_layout" RENAME COLUMN "schedule_heading" TO "left_column_heading";
        ALTER TABLE "public"."_pages_v_blocks_two_column_layout" RENAME COLUMN "membership_heading" TO "right_column_heading";
        ALTER TABLE "public"."_pages_v_blocks_two_column_layout" ALTER COLUMN "left_column_heading" SET DEFAULT 'Column one';
        ALTER TABLE "public"."_pages_v_blocks_two_column_layout" ALTER COLUMN "right_column_heading" SET DEFAULT 'Column two';
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = '_pages_v_blocks_two_column_layout'
          AND constraint_name = '_pages_v_blocks_dh_dashboard_layout_parent_id_fk'
      ) THEN
        ALTER TABLE "public"."_pages_v_blocks_two_column_layout"
          RENAME CONSTRAINT "_pages_v_blocks_dh_dashboard_layout_parent_id_fk" TO "_pages_v_blocks_two_column_layout_parent_id_fk";
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = '_pages_v_blocks_dh_dashboard_layout_order_idx') THEN
        ALTER INDEX "_pages_v_blocks_dh_dashboard_layout_order_idx" RENAME TO "_pages_v_blocks_two_column_layout_order_idx";
      END IF;
      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = '_pages_v_blocks_dh_dashboard_layout_parent_id_idx') THEN
        ALTER INDEX "_pages_v_blocks_dh_dashboard_layout_parent_id_idx" RENAME TO "_pages_v_blocks_two_column_layout_parent_id_idx";
      END IF;
      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = '_pages_v_blocks_dh_dashboard_layout_path_idx') THEN
        ALTER INDEX "_pages_v_blocks_dh_dashboard_layout_path_idx" RENAME TO "_pages_v_blocks_two_column_layout_path_idx";
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "tenants_allowed_blocks"
    SET "value" = 'dhDashboardLayout'::"public"."enum_tenants_allowed_blocks"
    WHERE "value"::text = 'twoColumnLayout';
  `)

  await db.execute(sql`
    DO $$
    DECLARE
      r record;
    BEGIN
      FOR r IN
        SELECT table_schema, table_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = '_path'
      LOOP
        EXECUTE format(
          'UPDATE %I.%I SET "_path" = replace(replace(replace("_path", %L, %L), %L, %L), %L, %L) WHERE "_path" LIKE %L OR "_path" LIKE %L OR "_path" LIKE %L',
          r.table_schema,
          r.table_name,
          'leftBlocks',
          'scheduleBlocks',
          'rightBlocks',
          'membershipBlocks',
          'twoColumnLayout',
          'dhDashboardLayout',
          '%leftBlocks%',
          '%rightBlocks%',
          '%twoColumnLayout%'
        );
      END LOOP;
    END $$;
  `)

  await db.execute(sql`
    UPDATE "pages_rels"
    SET "path" = replace(replace(replace("path", 'leftBlocks', 'scheduleBlocks'), 'rightBlocks', 'membershipBlocks'), 'twoColumnLayout', 'dhDashboardLayout')
    WHERE "path" LIKE '%leftBlocks%' OR "path" LIKE '%rightBlocks%' OR "path" LIKE '%twoColumnLayout%';
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'pages_blocks_two_column_layout'
      ) THEN
        ALTER TABLE "public"."pages_blocks_two_column_layout" RENAME COLUMN "left_column_heading" TO "schedule_heading";
        ALTER TABLE "public"."pages_blocks_two_column_layout" RENAME COLUMN "right_column_heading" TO "membership_heading";
        ALTER TABLE "public"."pages_blocks_two_column_layout" ALTER COLUMN "schedule_heading" SET DEFAULT 'Schedule';
        ALTER TABLE "public"."pages_blocks_two_column_layout" ALTER COLUMN "membership_heading" SET DEFAULT 'Membership Options';
        ALTER TABLE "public"."pages_blocks_two_column_layout" RENAME TO "pages_blocks_dh_dashboard_layout";
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'pages_blocks_dh_dashboard_layout'
          AND constraint_name = 'pages_blocks_two_column_layout_parent_id_fk'
      ) THEN
        ALTER TABLE "public"."pages_blocks_dh_dashboard_layout"
          RENAME CONSTRAINT "pages_blocks_two_column_layout_parent_id_fk" TO "pages_blocks_dh_dashboard_layout_parent_id_fk";
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'pages_blocks_two_column_layout_order_idx') THEN
        ALTER INDEX "pages_blocks_two_column_layout_order_idx" RENAME TO "pages_blocks_dh_dashboard_layout_order_idx";
      END IF;
      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'pages_blocks_two_column_layout_parent_id_idx') THEN
        ALTER INDEX "pages_blocks_two_column_layout_parent_id_idx" RENAME TO "pages_blocks_dh_dashboard_layout_parent_id_idx";
      END IF;
      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'pages_blocks_two_column_layout_path_idx') THEN
        ALTER INDEX "pages_blocks_two_column_layout_path_idx" RENAME TO "pages_blocks_dh_dashboard_layout_path_idx";
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = '_pages_v_blocks_two_column_layout'
      ) THEN
        ALTER TABLE "public"."_pages_v_blocks_two_column_layout" RENAME COLUMN "left_column_heading" TO "schedule_heading";
        ALTER TABLE "public"."_pages_v_blocks_two_column_layout" RENAME COLUMN "right_column_heading" TO "membership_heading";
        ALTER TABLE "public"."_pages_v_blocks_two_column_layout" ALTER COLUMN "schedule_heading" SET DEFAULT 'Schedule';
        ALTER TABLE "public"."_pages_v_blocks_two_column_layout" ALTER COLUMN "membership_heading" SET DEFAULT 'Membership Options';
        ALTER TABLE "public"."_pages_v_blocks_two_column_layout" RENAME TO "_pages_v_blocks_dh_dashboard_layout";
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = '_pages_v_blocks_dh_dashboard_layout'
          AND constraint_name = '_pages_v_blocks_two_column_layout_parent_id_fk'
      ) THEN
        ALTER TABLE "public"."_pages_v_blocks_dh_dashboard_layout"
          RENAME CONSTRAINT "_pages_v_blocks_two_column_layout_parent_id_fk" TO "_pages_v_blocks_dh_dashboard_layout_parent_id_fk";
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = '_pages_v_blocks_two_column_layout_order_idx') THEN
        ALTER INDEX "_pages_v_blocks_two_column_layout_order_idx" RENAME TO "_pages_v_blocks_dh_dashboard_layout_order_idx";
      END IF;
      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = '_pages_v_blocks_two_column_layout_parent_id_idx') THEN
        ALTER INDEX "_pages_v_blocks_two_column_layout_parent_id_idx" RENAME TO "_pages_v_blocks_dh_dashboard_layout_parent_id_idx";
      END IF;
      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = '_pages_v_blocks_two_column_layout_path_idx') THEN
        ALTER INDEX "_pages_v_blocks_two_column_layout_path_idx" RENAME TO "_pages_v_blocks_dh_dashboard_layout_path_idx";
      END IF;
    END $$;
  `)
}
