import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Create enum types idempotently (ignore if already exist from prior migrations)
  await db.execute(sql`
    DO $$ BEGIN CREATE TYPE "public"."enum_pages_blocks_hero_with_location_links_link_type" AS ENUM('reference', 'custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_pages_blocks_hero_with_location_links_link_appearance" AS ENUM('default', 'outline'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum__pages_v_blocks_hero_with_location_links_link_type" AS ENUM('reference', 'custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum__pages_v_blocks_hero_with_location_links_link_appearance" AS ENUM('default', 'outline'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_navbar_nav_items_icon" AS ENUM('none', 'instagram', 'facebook', 'x'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)

  // Create tables idempotently
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_hero_with_location_links" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "link_type" "public"."enum_pages_blocks_hero_with_location_links_link_type" DEFAULT 'reference',
      "link_new_tab" boolean,
      "link_url" varchar,
      "link_label" varchar,
      "link_appearance" "public"."enum_pages_blocks_hero_with_location_links_link_appearance" DEFAULT 'default'
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_hero_with_location" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "background_image_id" integer,
      "logo_id" integer,
      "title" varchar,
      "title_line2" varchar,
      "title_line1_accent" boolean DEFAULT true,
      "location_text" varchar,
      "location_subtext" varchar,
      "show_location_icon" boolean DEFAULT true,
      "social_follow_label" varchar,
      "social_follow_url" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_tenant_scoped_schedule" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "default_tenant_id" integer,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_hero_with_location_links" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "link_type" "public"."enum__pages_v_blocks_hero_with_location_links_link_type" DEFAULT 'reference',
      "link_new_tab" boolean,
      "link_url" varchar,
      "link_label" varchar,
      "link_appearance" "public"."enum__pages_v_blocks_hero_with_location_links_link_appearance" DEFAULT 'default',
      "_uuid" varchar
    );
    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_hero_with_location" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "background_image_id" integer,
      "logo_id" integer,
      "title" varchar,
      "title_line2" varchar,
      "title_line1_accent" boolean DEFAULT true,
      "location_text" varchar,
      "location_subtext" varchar,
      "show_location_icon" boolean DEFAULT true,
      "social_follow_label" varchar,
      "social_follow_url" varchar,
      "_uuid" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_tenant_scoped_schedule" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "default_tenant_id" integer,
      "_uuid" varchar,
      "block_name" varchar
    );
  `)

  // tenants_allowed_blocks enum change (idempotent: skip if type already updated)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "tenants_allowed_blocks" ALTER COLUMN "value" SET DATA TYPE text;
      DROP TYPE "public"."enum_tenants_allowed_blocks";
      CREATE TYPE "public"."enum_tenants_allowed_blocks" AS ENUM('location', 'healthBenefits', 'sectionTagline', 'faqs', 'mediaBlock', 'archive', 'formBlock', 'threeColumnLayout');
      ALTER TABLE "tenants_allowed_blocks" ALTER COLUMN "value" SET DATA TYPE "public"."enum_tenants_allowed_blocks" USING "value"::"public"."enum_tenants_allowed_blocks";
    EXCEPTION WHEN duplicate_object OR undefined_object THEN
      NULL;
    END $$;
  `)

  await db.execute(sql`
    DROP INDEX IF EXISTS "class_options_name_idx";
    DROP INDEX IF EXISTS "navbar_tenant_idx";
    DROP INDEX IF EXISTS "footer_tenant_idx";
    ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-02-17T12:54:26.169Z';
    ALTER TABLE "navbar_nav_items" ADD COLUMN IF NOT EXISTS "icon" "public"."enum_navbar_nav_items_icon" DEFAULT 'none';
  `)

  // Add foreign key constraints idempotently
  await db.execute(sql`
    DO $$ BEGIN ALTER TABLE "pages_blocks_hero_with_location_links" ADD CONSTRAINT "pages_blocks_hero_with_location_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_hero_with_location"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_hero_with_location" ADD CONSTRAINT "pages_blocks_hero_with_location_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_hero_with_location" ADD CONSTRAINT "pages_blocks_hero_with_location_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_hero_with_location" ADD CONSTRAINT "pages_blocks_hero_with_location_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_tenant_scoped_schedule" ADD CONSTRAINT "pages_blocks_tenant_scoped_schedule_default_tenant_id_tenants_id_fk" FOREIGN KEY ("default_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_tenant_scoped_schedule" ADD CONSTRAINT "pages_blocks_tenant_scoped_schedule_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "_pages_v_blocks_hero_with_location_links" ADD CONSTRAINT "_pages_v_blocks_hero_with_location_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_hero_with_location"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "_pages_v_blocks_hero_with_location" ADD CONSTRAINT "_pages_v_blocks_hero_with_location_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "_pages_v_blocks_hero_with_location" ADD CONSTRAINT "_pages_v_blocks_hero_with_location_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "_pages_v_blocks_hero_with_location" ADD CONSTRAINT "_pages_v_blocks_hero_with_location_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "_pages_v_blocks_tenant_scoped_schedule" ADD CONSTRAINT "_pages_v_blocks_tenant_scoped_schedule_default_tenant_id_tenants_id_fk" FOREIGN KEY ("default_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "_pages_v_blocks_tenant_scoped_schedule" ADD CONSTRAINT "_pages_v_blocks_tenant_scoped_schedule_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)

  // Create indexes idempotently
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "pages_blocks_hero_with_location_links_order_idx" ON "pages_blocks_hero_with_location_links" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_hero_with_location_links_parent_id_idx" ON "pages_blocks_hero_with_location_links" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_hero_with_location_order_idx" ON "pages_blocks_hero_with_location" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_hero_with_location_parent_id_idx" ON "pages_blocks_hero_with_location" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_hero_with_location_path_idx" ON "pages_blocks_hero_with_location" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_hero_with_location_background_image_idx" ON "pages_blocks_hero_with_location" USING btree ("background_image_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_hero_with_location_logo_idx" ON "pages_blocks_hero_with_location" USING btree ("logo_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_tenant_scoped_schedule_order_idx" ON "pages_blocks_tenant_scoped_schedule" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_tenant_scoped_schedule_parent_id_idx" ON "pages_blocks_tenant_scoped_schedule" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_tenant_scoped_schedule_path_idx" ON "pages_blocks_tenant_scoped_schedule" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_tenant_scoped_schedule_default_tenant_idx" ON "pages_blocks_tenant_scoped_schedule" USING btree ("default_tenant_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_hero_with_location_links_order_idx" ON "_pages_v_blocks_hero_with_location_links" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_hero_with_location_links_parent_id_idx" ON "_pages_v_blocks_hero_with_location_links" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_hero_with_location_order_idx" ON "_pages_v_blocks_hero_with_location" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_hero_with_location_parent_id_idx" ON "_pages_v_blocks_hero_with_location" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_hero_with_location_path_idx" ON "_pages_v_blocks_hero_with_location" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_hero_with_location_background_image_idx" ON "_pages_v_blocks_hero_with_location" USING btree ("background_image_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_hero_with_location_logo_idx" ON "_pages_v_blocks_hero_with_location" USING btree ("logo_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_tenant_scoped_schedule_order_idx" ON "_pages_v_blocks_tenant_scoped_schedule" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_tenant_scoped_schedule_parent_id_idx" ON "_pages_v_blocks_tenant_scoped_schedule" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_tenant_scoped_schedule_path_idx" ON "_pages_v_blocks_tenant_scoped_schedule" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_tenant_scoped_schedule_default_tenant_idx" ON "_pages_v_blocks_tenant_scoped_schedule" USING btree ("default_tenant_id");
    CREATE INDEX IF NOT EXISTS "navbar_tenant_idx" ON "navbar" USING btree ("tenant_id");
    CREATE INDEX IF NOT EXISTS "footer_tenant_idx" ON "footer" USING btree ("tenant_id");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE 'heroScheduleSanctuary' BEFORE 'location';
  ALTER TABLE "pages_blocks_hero_with_location_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_hero_with_location" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_tenant_scoped_schedule" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_hero_with_location_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_hero_with_location" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_tenant_scoped_schedule" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_blocks_hero_with_location_links" CASCADE;
  DROP TABLE "pages_blocks_hero_with_location" CASCADE;
  DROP TABLE "pages_blocks_tenant_scoped_schedule" CASCADE;
  DROP TABLE "_pages_v_blocks_hero_with_location_links" CASCADE;
  DROP TABLE "_pages_v_blocks_hero_with_location" CASCADE;
  DROP TABLE "_pages_v_blocks_tenant_scoped_schedule" CASCADE;
  DROP INDEX "navbar_tenant_idx";
  DROP INDEX "footer_tenant_idx";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-02-13T17:10:59.906Z';
  CREATE UNIQUE INDEX "class_options_name_idx" ON "class_options" USING btree ("name");
  CREATE UNIQUE INDEX "navbar_tenant_idx" ON "navbar" USING btree ("tenant_id");
  CREATE UNIQUE INDEX "footer_tenant_idx" ON "footer" USING btree ("tenant_id");
  ALTER TABLE "navbar_nav_items" DROP COLUMN "icon";
  DROP TYPE "public"."enum_pages_blocks_hero_with_location_links_link_type";
  DROP TYPE "public"."enum_pages_blocks_hero_with_location_links_link_appearance";
  DROP TYPE "public"."enum__pages_v_blocks_hero_with_location_links_link_type";
  DROP TYPE "public"."enum__pages_v_blocks_hero_with_location_links_link_appearance";
  DROP TYPE "public"."enum_navbar_nav_items_icon";`)
}
