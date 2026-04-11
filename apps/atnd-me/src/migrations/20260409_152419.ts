import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Pages blocks: `dhLiveSchedule`, `dhLiveMembership`, `dhDashboardLayout` (+ version tables).
 * Tenant allowedBlocks enum values for the same slugs.
 *
 * Nested blocks inside `dhDashboardLayout` use existing `pages_blocks_*` tables with `_path`
 * (same pattern as `threeColumnLayout`); no extra tables required.
 *
 * Idempotent where possible.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE IF NOT EXISTS 'dhLiveSchedule' BEFORE 'threeColumnLayout';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE IF NOT EXISTS 'dhLiveMembership' BEFORE 'threeColumnLayout';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE IF NOT EXISTS 'dhDashboardLayout' BEFORE 'threeColumnLayout';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_dh_live_schedule" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "tenant_id" numeric,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_dh_live_membership" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_dh_dashboard_layout" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "schedule_heading" varchar DEFAULT 'Schedule',
      "membership_heading" varchar DEFAULT 'Membership Options',
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_dh_live_schedule" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "tenant_id" numeric,
      "_uuid" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_dh_live_membership" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "_uuid" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_dh_dashboard_layout" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "schedule_heading" varchar DEFAULT 'Schedule',
      "membership_heading" varchar DEFAULT 'Membership Options',
      "_uuid" varchar,
      "block_name" varchar
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_dh_live_schedule"
      ADD CONSTRAINT "pages_blocks_dh_live_schedule_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_dh_live_membership"
      ADD CONSTRAINT "pages_blocks_dh_live_membership_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_dh_dashboard_layout"
      ADD CONSTRAINT "pages_blocks_dh_dashboard_layout_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_dh_live_schedule"
      ADD CONSTRAINT "_pages_v_blocks_dh_live_schedule_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_dh_live_membership"
      ADD CONSTRAINT "_pages_v_blocks_dh_live_membership_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_dh_dashboard_layout"
      ADD CONSTRAINT "_pages_v_blocks_dh_dashboard_layout_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "pages_blocks_dh_live_schedule_order_idx" ON "pages_blocks_dh_live_schedule" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_dh_live_schedule_parent_id_idx" ON "pages_blocks_dh_live_schedule" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_dh_live_schedule_path_idx" ON "pages_blocks_dh_live_schedule" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_dh_live_membership_order_idx" ON "pages_blocks_dh_live_membership" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_dh_live_membership_parent_id_idx" ON "pages_blocks_dh_live_membership" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_dh_live_membership_path_idx" ON "pages_blocks_dh_live_membership" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_dh_dashboard_layout_order_idx" ON "pages_blocks_dh_dashboard_layout" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_dh_dashboard_layout_parent_id_idx" ON "pages_blocks_dh_dashboard_layout" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_dh_dashboard_layout_path_idx" ON "pages_blocks_dh_dashboard_layout" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_dh_live_schedule_order_idx" ON "_pages_v_blocks_dh_live_schedule" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_dh_live_schedule_parent_id_idx" ON "_pages_v_blocks_dh_live_schedule" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_dh_live_schedule_path_idx" ON "_pages_v_blocks_dh_live_schedule" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_dh_live_membership_order_idx" ON "_pages_v_blocks_dh_live_membership" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_dh_live_membership_parent_id_idx" ON "_pages_v_blocks_dh_live_membership" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_dh_live_membership_path_idx" ON "_pages_v_blocks_dh_live_membership" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_dh_dashboard_layout_order_idx" ON "_pages_v_blocks_dh_dashboard_layout" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_dh_dashboard_layout_parent_id_idx" ON "_pages_v_blocks_dh_dashboard_layout" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_dh_dashboard_layout_path_idx" ON "_pages_v_blocks_dh_dashboard_layout" USING btree ("_path");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "pages_blocks_dh_live_schedule" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_dh_live_membership" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_dh_dashboard_layout" CASCADE;
    DROP TABLE IF EXISTS "_pages_v_blocks_dh_live_schedule" CASCADE;
    DROP TABLE IF EXISTS "_pages_v_blocks_dh_live_membership" CASCADE;
    DROP TABLE IF EXISTS "_pages_v_blocks_dh_dashboard_layout" CASCADE;
  `)
}
