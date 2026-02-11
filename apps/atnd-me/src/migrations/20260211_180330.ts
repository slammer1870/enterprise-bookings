import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Idempotent migration for hero_sched_sanc, health_benefits, section_tagline blocks
 * and tenants_allowed_blocks. Uses IF NOT EXISTS / DO blocks so deployment
 * succeeds when objects already exist (e.g. tenants_allowed_blocks from 20260211_tenants_allowed_blocks).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Create enums only if they don't exist
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typname = 'enum_hero_sched_sanc_links_link_type') THEN
        CREATE TYPE "public"."enum_hero_sched_sanc_links_link_type" AS ENUM('reference', 'custom');
      END IF;
    END $$;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typname = 'enum_hero_sched_sanc_links_link_appearance') THEN
        CREATE TYPE "public"."enum_hero_sched_sanc_links_link_appearance" AS ENUM('default', 'outline');
      END IF;
    END $$;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typname = 'enum__hero_sched_sanc_v_links_link_type') THEN
        CREATE TYPE "public"."enum__hero_sched_sanc_v_links_link_type" AS ENUM('reference', 'custom');
      END IF;
    END $$;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typname = 'enum__hero_sched_sanc_v_links_link_appearance') THEN
        CREATE TYPE "public"."enum__hero_sched_sanc_v_links_link_appearance" AS ENUM('default', 'outline');
      END IF;
    END $$;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typname = 'enum_tenants_allowed_blocks') THEN
        CREATE TYPE "public"."enum_tenants_allowed_blocks" AS ENUM('heroScheduleSanctuary', 'location', 'healthBenefits', 'sectionTagline', 'faqs', 'mediaBlock', 'archive', 'formBlock', 'threeColumnLayout');
      END IF;
    END $$;
  `)

  // 2. Create tables only if they don't exist
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "hero_sched_sanc_links" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "link_type" "enum_hero_sched_sanc_links_link_type" DEFAULT 'reference',
      "link_new_tab" boolean,
      "link_url" varchar,
      "link_label" varchar,
      "link_appearance" "enum_hero_sched_sanc_links_link_appearance" DEFAULT 'default'
    );
    CREATE TABLE IF NOT EXISTS "hero_sched_sanc" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "background_image_id" integer,
      "logo_id" integer,
      "title" varchar,
      "subtitle" varchar,
      "tagline" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_health_benefits_items" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" varchar,
      "description" varchar
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_health_benefits" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "section_title" varchar DEFAULT 'Health Benefits of Sauna',
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_section_tagline" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" varchar,
      "subtitle" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "_hero_sched_sanc_v_links" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "link_type" "enum__hero_sched_sanc_v_links_link_type" DEFAULT 'reference',
      "link_new_tab" boolean,
      "link_url" varchar,
      "link_label" varchar,
      "link_appearance" "enum__hero_sched_sanc_v_links_link_appearance" DEFAULT 'default',
      "_uuid" varchar
    );
    CREATE TABLE IF NOT EXISTS "_hero_sched_sanc_v" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "background_image_id" integer,
      "logo_id" integer,
      "title" varchar,
      "subtitle" varchar,
      "tagline" varchar,
      "_uuid" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_health_benefits_items" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar,
      "description" varchar,
      "_uuid" varchar
    );
    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_health_benefits" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "section_title" varchar DEFAULT 'Health Benefits of Sauna',
      "_uuid" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_section_tagline" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar,
      "subtitle" varchar,
      "_uuid" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "tenants_allowed_blocks" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum_tenants_allowed_blocks",
      "id" serial PRIMARY KEY NOT NULL
    );
  `)

  // If tenants_allowed_blocks already existed (e.g. from 20260211_tenants_allowed_blocks) with varchar value, upgrade to enum
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tenants_allowed_blocks' AND column_name = 'value' AND data_type = 'character varying'
      ) THEN
        ALTER TABLE "tenants_allowed_blocks"
          ALTER COLUMN "value" TYPE "enum_tenants_allowed_blocks" USING "value"::"enum_tenants_allowed_blocks";
      END IF;
    END $$;
  `)

  // 3. Alter lessons default (idempotent)
  await db.execute(sql`
    ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-02-11T18:03:30.384Z';
  `)

  // 4. Add constraints (ignore if already exist)
  const constraints = [
    `ALTER TABLE "hero_sched_sanc_links" ADD CONSTRAINT "hero_sched_sanc_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."hero_sched_sanc"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "hero_sched_sanc" ADD CONSTRAINT "hero_sched_sanc_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action`,
    `ALTER TABLE "hero_sched_sanc" ADD CONSTRAINT "hero_sched_sanc_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action`,
    `ALTER TABLE "hero_sched_sanc" ADD CONSTRAINT "hero_sched_sanc_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "pages_blocks_health_benefits_items" ADD CONSTRAINT "pages_blocks_health_benefits_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_health_benefits"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "pages_blocks_health_benefits" ADD CONSTRAINT "pages_blocks_health_benefits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "pages_blocks_section_tagline" ADD CONSTRAINT "pages_blocks_section_tagline_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "_hero_sched_sanc_v_links" ADD CONSTRAINT "_hero_sched_sanc_v_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_hero_sched_sanc_v"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "_hero_sched_sanc_v" ADD CONSTRAINT "_hero_sched_sanc_v_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action`,
    `ALTER TABLE "_hero_sched_sanc_v" ADD CONSTRAINT "_hero_sched_sanc_v_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action`,
    `ALTER TABLE "_hero_sched_sanc_v" ADD CONSTRAINT "_hero_sched_sanc_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "_pages_v_blocks_health_benefits_items" ADD CONSTRAINT "_pages_v_blocks_health_benefits_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_health_benefits"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "_pages_v_blocks_health_benefits" ADD CONSTRAINT "_pages_v_blocks_health_benefits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "_pages_v_blocks_section_tagline" ADD CONSTRAINT "_pages_v_blocks_section_tagline_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "tenants_allowed_blocks" ADD CONSTRAINT "tenants_allowed_blocks_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action`,
  ]
  for (const stmt of constraints) {
    await db.execute(sql.raw(`
      DO $$ BEGIN
        ${stmt};
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `))
  }

  // 5. Create indexes only if they don't exist
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "hero_sched_sanc_links_order_idx" ON "hero_sched_sanc_links" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "hero_sched_sanc_links_parent_id_idx" ON "hero_sched_sanc_links" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "hero_sched_sanc_order_idx" ON "hero_sched_sanc" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "hero_sched_sanc_parent_id_idx" ON "hero_sched_sanc" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "hero_sched_sanc_path_idx" ON "hero_sched_sanc" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "hero_sched_sanc_background_image_idx" ON "hero_sched_sanc" USING btree ("background_image_id");
    CREATE INDEX IF NOT EXISTS "hero_sched_sanc_logo_idx" ON "hero_sched_sanc" USING btree ("logo_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_health_benefits_items_order_idx" ON "pages_blocks_health_benefits_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_health_benefits_items_parent_id_idx" ON "pages_blocks_health_benefits_items" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_health_benefits_order_idx" ON "pages_blocks_health_benefits" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_health_benefits_parent_id_idx" ON "pages_blocks_health_benefits" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_health_benefits_path_idx" ON "pages_blocks_health_benefits" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_section_tagline_order_idx" ON "pages_blocks_section_tagline" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_section_tagline_parent_id_idx" ON "pages_blocks_section_tagline" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_section_tagline_path_idx" ON "pages_blocks_section_tagline" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "_hero_sched_sanc_v_links_order_idx" ON "_hero_sched_sanc_v_links" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_hero_sched_sanc_v_links_parent_id_idx" ON "_hero_sched_sanc_v_links" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_hero_sched_sanc_v_order_idx" ON "_hero_sched_sanc_v" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_hero_sched_sanc_v_parent_id_idx" ON "_hero_sched_sanc_v" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_hero_sched_sanc_v_path_idx" ON "_hero_sched_sanc_v" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "_hero_sched_sanc_v_background_image_idx" ON "_hero_sched_sanc_v" USING btree ("background_image_id");
    CREATE INDEX IF NOT EXISTS "_hero_sched_sanc_v_logo_idx" ON "_hero_sched_sanc_v" USING btree ("logo_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_health_benefits_items_order_idx" ON "_pages_v_blocks_health_benefits_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_health_benefits_items_parent_id_idx" ON "_pages_v_blocks_health_benefits_items" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_health_benefits_order_idx" ON "_pages_v_blocks_health_benefits" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_health_benefits_parent_id_idx" ON "_pages_v_blocks_health_benefits" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_health_benefits_path_idx" ON "_pages_v_blocks_health_benefits" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_section_tagline_order_idx" ON "_pages_v_blocks_section_tagline" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_section_tagline_parent_id_idx" ON "_pages_v_blocks_section_tagline" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_section_tagline_path_idx" ON "_pages_v_blocks_section_tagline" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "tenants_allowed_blocks_order_idx" ON "tenants_allowed_blocks" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "tenants_allowed_blocks_parent_idx" ON "tenants_allowed_blocks" USING btree ("parent_id");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "hero_sched_sanc_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "hero_sched_sanc" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_health_benefits_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_health_benefits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_section_tagline" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_hero_sched_sanc_v_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_hero_sched_sanc_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_health_benefits_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_health_benefits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_section_tagline" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tenants_allowed_blocks" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "hero_sched_sanc_links" CASCADE;
  DROP TABLE IF EXISTS "hero_sched_sanc" CASCADE;
  DROP TABLE IF EXISTS "pages_blocks_health_benefits_items" CASCADE;
  DROP TABLE IF EXISTS "pages_blocks_health_benefits" CASCADE;
  DROP TABLE IF EXISTS "pages_blocks_section_tagline" CASCADE;
  DROP TABLE IF EXISTS "_hero_sched_sanc_v_links" CASCADE;
  DROP TABLE IF EXISTS "_hero_sched_sanc_v" CASCADE;
  DROP TABLE IF EXISTS "_pages_v_blocks_health_benefits_items" CASCADE;
  DROP TABLE IF EXISTS "_pages_v_blocks_health_benefits" CASCADE;
  DROP TABLE IF EXISTS "_pages_v_blocks_section_tagline" CASCADE;
  DROP TABLE IF EXISTS "tenants_allowed_blocks" CASCADE;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-02-11T14:48:27.176Z';
  DROP TYPE IF EXISTS "public"."enum_hero_sched_sanc_links_link_type";
  DROP TYPE IF EXISTS "public"."enum_hero_sched_sanc_links_link_appearance";
  DROP TYPE IF EXISTS "public"."enum__hero_sched_sanc_v_links_link_type";
  DROP TYPE IF EXISTS "public"."enum__hero_sched_sanc_v_links_link_appearance";
  DROP TYPE IF EXISTS "public"."enum_tenants_allowed_blocks";`)
}
