import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Create enums idempotently (ignore if already exist from partial run)
  const enumTypes = [
    ['enum_pages_blocks_marketing_hero_links_link_type', "('reference', 'custom')"],
    ['enum_pages_blocks_marketing_hero_links_link_appearance', "('default', 'outline')"],
    ['enum_pages_blocks_marketing_hero_alignment', "('left', 'center', 'right')"],
    ['enum_pages_blocks_marketing_hero_background_color', "('default', 'subtle', 'muted')"],
    ['enum_pages_blocks_features_features_link_type', "('reference', 'custom')"],
    ['enum_pages_blocks_features_columns', "('2', '3', '4')"],
    ['enum_pages_blocks_features_background_color', "('default', 'subtle', 'muted')"],
    ['enum_pages_blocks_case_studies_case_studies_link_type', "('reference', 'custom')"],
    ['enum_pages_blocks_case_studies_layout', "('grid', 'carousel')"],
    ['enum_pages_blocks_case_studies_background_color', "('default', 'subtle', 'muted')"],
    ['enum_pages_blocks_marketing_cta_links_link_type', "('reference', 'custom')"],
    ['enum_pages_blocks_marketing_cta_links_link_appearance', "('default', 'outline')"],
    ['enum_pages_blocks_marketing_cta_variant', "('default', 'highlighted', 'bordered')"],
    ['enum_pages_blocks_marketing_cta_alignment', "('left', 'center', 'right')"],
    ['enum__pages_v_blocks_marketing_hero_links_link_type', "('reference', 'custom')"],
    ['enum__pages_v_blocks_marketing_hero_links_link_appearance', "('default', 'outline')"],
    ['enum__pages_v_blocks_marketing_hero_alignment', "('left', 'center', 'right')"],
    ['enum__pages_v_blocks_marketing_hero_background_color', "('default', 'subtle', 'muted')"],
    ['enum__pages_v_blocks_features_features_link_type', "('reference', 'custom')"],
    ['enum__pages_v_blocks_features_columns', "('2', '3', '4')"],
    ['enum__pages_v_blocks_features_background_color', "('default', 'subtle', 'muted')"],
    ['enum__pages_v_blocks_case_studies_case_studies_link_type', "('reference', 'custom')"],
    ['enum__pages_v_blocks_case_studies_layout', "('grid', 'carousel')"],
    ['enum__pages_v_blocks_case_studies_background_color', "('default', 'subtle', 'muted')"],
    ['enum__pages_v_blocks_marketing_cta_links_link_type', "('reference', 'custom')"],
    ['enum__pages_v_blocks_marketing_cta_links_link_appearance', "('default', 'outline')"],
    ['enum__pages_v_blocks_marketing_cta_variant', "('default', 'highlighted', 'bordered')"],
    ['enum__pages_v_blocks_marketing_cta_alignment', "('left', 'center', 'right')"],
  ] as const
  for (const [typeName, values] of enumTypes) {
    await db.execute(
      sql.raw(
        `DO $$ BEGIN CREATE TYPE "public"."${typeName}" AS ENUM${values}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
      ),
    )
  }

  // ALTER TYPE ... ADD VALUE idempotently
  const tenantBlockValues = [
    ['marketingHero', 'location'],
    ['features', 'mediaBlock'],
    ['caseStudies', 'mediaBlock'],
    ['marketingCta', 'mediaBlock'],
  ] as const
  for (const [value, before] of tenantBlockValues) {
    await db.execute(
      sql.raw(
        `DO $$ BEGIN ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE '${value}' BEFORE '${before}'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
      ),
    )
  }

  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "pages_blocks_marketing_hero_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_pages_blocks_marketing_hero_links_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_appearance" "enum_pages_blocks_marketing_hero_links_link_appearance" DEFAULT 'default'
  );
  
  CREATE TABLE IF NOT EXISTS "pages_blocks_marketing_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"headline" varchar,
  	"subheadline" jsonb,
  	"background_media_id" integer,
  	"foreground_media_id" integer,
  	"alignment" "enum_pages_blocks_marketing_hero_alignment" DEFAULT 'center',
  	"background_color" "enum_pages_blocks_marketing_hero_background_color" DEFAULT 'default',
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "pages_blocks_features_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"icon_id" integer,
  	"link_type" "enum_pages_blocks_features_features_link_type" DEFAULT 'reference',
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_new_tab" boolean
  );
  
  CREATE TABLE IF NOT EXISTS "pages_blocks_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"description" jsonb,
  	"columns" "enum_pages_blocks_features_columns" DEFAULT '3',
  	"background_color" "enum_pages_blocks_features_background_color" DEFAULT 'default',
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "pages_blocks_case_studies_case_studies_results" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"metric" varchar,
  	"description" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "pages_blocks_case_studies_case_studies" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"company_name" varchar,
  	"company_logo_id" integer,
  	"quote" varchar,
  	"author_name" varchar,
  	"author_title" varchar,
  	"author_avatar_id" integer,
  	"link_type" "enum_pages_blocks_case_studies_case_studies_link_type" DEFAULT 'custom',
  	"link_url" varchar,
  	"link_label" varchar DEFAULT 'Read full case study',
  	"link_new_tab" boolean
  );
  
  CREATE TABLE IF NOT EXISTS "pages_blocks_case_studies" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"description" jsonb,
  	"layout" "enum_pages_blocks_case_studies_layout" DEFAULT 'grid',
  	"background_color" "enum_pages_blocks_case_studies_background_color" DEFAULT 'default',
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "pages_blocks_marketing_cta_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_pages_blocks_marketing_cta_links_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_appearance" "enum_pages_blocks_marketing_cta_links_link_appearance" DEFAULT 'default'
  );
  
  CREATE TABLE IF NOT EXISTS "pages_blocks_marketing_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"description" jsonb,
  	"background_media_id" integer,
  	"variant" "enum_pages_blocks_marketing_cta_variant" DEFAULT 'default',
  	"alignment" "enum_pages_blocks_marketing_cta_alignment" DEFAULT 'center',
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "_pages_v_blocks_marketing_hero_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"link_type" "enum__pages_v_blocks_marketing_hero_links_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_appearance" "enum__pages_v_blocks_marketing_hero_links_link_appearance" DEFAULT 'default',
  	"_uuid" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "_pages_v_blocks_marketing_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"headline" varchar,
  	"subheadline" jsonb,
  	"background_media_id" integer,
  	"foreground_media_id" integer,
  	"alignment" "enum__pages_v_blocks_marketing_hero_alignment" DEFAULT 'center',
  	"background_color" "enum__pages_v_blocks_marketing_hero_background_color" DEFAULT 'default',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "_pages_v_blocks_features_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"icon_id" integer,
  	"link_type" "enum__pages_v_blocks_features_features_link_type" DEFAULT 'reference',
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_new_tab" boolean,
  	"_uuid" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "_pages_v_blocks_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"description" jsonb,
  	"columns" "enum__pages_v_blocks_features_columns" DEFAULT '3',
  	"background_color" "enum__pages_v_blocks_features_background_color" DEFAULT 'default',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "_pages_v_blocks_case_studies_case_studies_results" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"metric" varchar,
  	"description" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "_pages_v_blocks_case_studies_case_studies" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"company_name" varchar,
  	"company_logo_id" integer,
  	"quote" varchar,
  	"author_name" varchar,
  	"author_title" varchar,
  	"author_avatar_id" integer,
  	"link_type" "enum__pages_v_blocks_case_studies_case_studies_link_type" DEFAULT 'custom',
  	"link_url" varchar,
  	"link_label" varchar DEFAULT 'Read full case study',
  	"link_new_tab" boolean,
  	"_uuid" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "_pages_v_blocks_case_studies" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"description" jsonb,
  	"layout" "enum__pages_v_blocks_case_studies_layout" DEFAULT 'grid',
  	"background_color" "enum__pages_v_blocks_case_studies_background_color" DEFAULT 'default',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "_pages_v_blocks_marketing_cta_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"link_type" "enum__pages_v_blocks_marketing_cta_links_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_appearance" "enum__pages_v_blocks_marketing_cta_links_link_appearance" DEFAULT 'default',
  	"_uuid" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "_pages_v_blocks_marketing_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"description" jsonb,
  	"background_media_id" integer,
  	"variant" "enum__pages_v_blocks_marketing_cta_variant" DEFAULT 'default',
  	"alignment" "enum__pages_v_blocks_marketing_cta_alignment" DEFAULT 'center',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-02-19T18:08:12.105Z';`)
  const constraints = [
    `ALTER TABLE "pages_blocks_marketing_hero_links" ADD CONSTRAINT "pages_blocks_marketing_hero_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_marketing_hero"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "pages_blocks_marketing_hero" ADD CONSTRAINT "pages_blocks_marketing_hero_background_media_id_media_id_fk" FOREIGN KEY ("background_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action`,
    `ALTER TABLE "pages_blocks_marketing_hero" ADD CONSTRAINT "pages_blocks_marketing_hero_foreground_media_id_media_id_fk" FOREIGN KEY ("foreground_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action`,
    `ALTER TABLE "pages_blocks_marketing_hero" ADD CONSTRAINT "pages_blocks_marketing_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "pages_blocks_features_features" ADD CONSTRAINT "pages_blocks_features_features_icon_id_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action`,
    `ALTER TABLE "pages_blocks_features_features" ADD CONSTRAINT "pages_blocks_features_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_features"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "pages_blocks_features" ADD CONSTRAINT "pages_blocks_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "pages_blocks_case_studies_case_studies_results" ADD CONSTRAINT "pages_blocks_case_studies_case_studies_results_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_case_studies_case_studies"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "pages_blocks_case_studies_case_studies" ADD CONSTRAINT "pages_blocks_case_studies_case_studies_company_logo_id_media_id_fk" FOREIGN KEY ("company_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action`,
    `ALTER TABLE "pages_blocks_case_studies_case_studies" ADD CONSTRAINT "pages_blocks_case_studies_case_studies_author_avatar_id_media_id_fk" FOREIGN KEY ("author_avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action`,
    `ALTER TABLE "pages_blocks_case_studies_case_studies" ADD CONSTRAINT "pages_blocks_case_studies_case_studies_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_case_studies"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "pages_blocks_case_studies" ADD CONSTRAINT "pages_blocks_case_studies_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "pages_blocks_marketing_cta_links" ADD CONSTRAINT "pages_blocks_marketing_cta_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_marketing_cta"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "pages_blocks_marketing_cta" ADD CONSTRAINT "pages_blocks_marketing_cta_background_media_id_media_id_fk" FOREIGN KEY ("background_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action`,
    `ALTER TABLE "pages_blocks_marketing_cta" ADD CONSTRAINT "pages_blocks_marketing_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "_pages_v_blocks_marketing_hero_links" ADD CONSTRAINT "_pages_v_blocks_marketing_hero_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_marketing_hero"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "_pages_v_blocks_marketing_hero" ADD CONSTRAINT "_pages_v_blocks_marketing_hero_background_media_id_media_id_fk" FOREIGN KEY ("background_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action`,
    `ALTER TABLE "_pages_v_blocks_marketing_hero" ADD CONSTRAINT "_pages_v_blocks_marketing_hero_foreground_media_id_media_id_fk" FOREIGN KEY ("foreground_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action`,
    `ALTER TABLE "_pages_v_blocks_marketing_hero" ADD CONSTRAINT "_pages_v_blocks_marketing_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "_pages_v_blocks_features_features" ADD CONSTRAINT "_pages_v_blocks_features_features_icon_id_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action`,
    `ALTER TABLE "_pages_v_blocks_features_features" ADD CONSTRAINT "_pages_v_blocks_features_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_features"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "_pages_v_blocks_features" ADD CONSTRAINT "_pages_v_blocks_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "_pages_v_blocks_case_studies_case_studies_results" ADD CONSTRAINT "_pages_v_blocks_case_studies_case_studies_results_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_case_studies_case_studies"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "_pages_v_blocks_case_studies_case_studies" ADD CONSTRAINT "_pages_v_blocks_case_studies_case_studies_company_logo_id_media_id_fk" FOREIGN KEY ("company_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action`,
    `ALTER TABLE "_pages_v_blocks_case_studies_case_studies" ADD CONSTRAINT "_pages_v_blocks_case_studies_case_studies_author_avatar_id_media_id_fk" FOREIGN KEY ("author_avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action`,
    `ALTER TABLE "_pages_v_blocks_case_studies_case_studies" ADD CONSTRAINT "_pages_v_blocks_case_studies_case_studies_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_case_studies"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "_pages_v_blocks_case_studies" ADD CONSTRAINT "_pages_v_blocks_case_studies_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "_pages_v_blocks_marketing_cta_links" ADD CONSTRAINT "_pages_v_blocks_marketing_cta_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_marketing_cta"("id") ON DELETE cascade ON UPDATE no action`,
    `ALTER TABLE "_pages_v_blocks_marketing_cta" ADD CONSTRAINT "_pages_v_blocks_marketing_cta_background_media_id_media_id_fk" FOREIGN KEY ("background_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action`,
    `ALTER TABLE "_pages_v_blocks_marketing_cta" ADD CONSTRAINT "_pages_v_blocks_marketing_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action`,
  ]
  for (const stmt of constraints) {
    await db.execute(sql.raw(`DO $$ BEGIN ${stmt}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`))
  }
  await db.execute(sql`
  CREATE INDEX IF NOT EXISTS "pages_blocks_marketing_hero_links_order_idx" ON "pages_blocks_marketing_hero_links" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_marketing_hero_links_parent_id_idx" ON "pages_blocks_marketing_hero_links" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_marketing_hero_order_idx" ON "pages_blocks_marketing_hero" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_marketing_hero_parent_id_idx" ON "pages_blocks_marketing_hero" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_marketing_hero_path_idx" ON "pages_blocks_marketing_hero" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_marketing_hero_background_media_idx" ON "pages_blocks_marketing_hero" USING btree ("background_media_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_marketing_hero_foreground_media_idx" ON "pages_blocks_marketing_hero" USING btree ("foreground_media_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_features_features_order_idx" ON "pages_blocks_features_features" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_features_features_parent_id_idx" ON "pages_blocks_features_features" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_features_features_icon_idx" ON "pages_blocks_features_features" USING btree ("icon_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_features_order_idx" ON "pages_blocks_features" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_features_parent_id_idx" ON "pages_blocks_features" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_features_path_idx" ON "pages_blocks_features" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_case_studies_case_studies_results_order_idx" ON "pages_blocks_case_studies_case_studies_results" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_case_studies_case_studies_results_parent_id_idx" ON "pages_blocks_case_studies_case_studies_results" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_case_studies_case_studies_order_idx" ON "pages_blocks_case_studies_case_studies" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_case_studies_case_studies_parent_id_idx" ON "pages_blocks_case_studies_case_studies" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_case_studies_case_studies_company_logo_idx" ON "pages_blocks_case_studies_case_studies" USING btree ("company_logo_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_case_studies_case_studies_author_author_ava_idx" ON "pages_blocks_case_studies_case_studies" USING btree ("author_avatar_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_case_studies_order_idx" ON "pages_blocks_case_studies" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_case_studies_parent_id_idx" ON "pages_blocks_case_studies" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_case_studies_path_idx" ON "pages_blocks_case_studies" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_marketing_cta_links_order_idx" ON "pages_blocks_marketing_cta_links" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_marketing_cta_links_parent_id_idx" ON "pages_blocks_marketing_cta_links" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_marketing_cta_order_idx" ON "pages_blocks_marketing_cta" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_marketing_cta_parent_id_idx" ON "pages_blocks_marketing_cta" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_marketing_cta_path_idx" ON "pages_blocks_marketing_cta" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_marketing_cta_background_media_idx" ON "pages_blocks_marketing_cta" USING btree ("background_media_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_marketing_hero_links_order_idx" ON "_pages_v_blocks_marketing_hero_links" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_marketing_hero_links_parent_id_idx" ON "_pages_v_blocks_marketing_hero_links" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_marketing_hero_order_idx" ON "_pages_v_blocks_marketing_hero" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_marketing_hero_parent_id_idx" ON "_pages_v_blocks_marketing_hero" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_marketing_hero_path_idx" ON "_pages_v_blocks_marketing_hero" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_marketing_hero_background_media_idx" ON "_pages_v_blocks_marketing_hero" USING btree ("background_media_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_marketing_hero_foreground_media_idx" ON "_pages_v_blocks_marketing_hero" USING btree ("foreground_media_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_features_features_order_idx" ON "_pages_v_blocks_features_features" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_features_features_parent_id_idx" ON "_pages_v_blocks_features_features" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_features_features_icon_idx" ON "_pages_v_blocks_features_features" USING btree ("icon_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_features_order_idx" ON "_pages_v_blocks_features" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_features_parent_id_idx" ON "_pages_v_blocks_features" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_features_path_idx" ON "_pages_v_blocks_features" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_case_studies_case_studies_results_order_idx" ON "_pages_v_blocks_case_studies_case_studies_results" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_case_studies_case_studies_results_parent_id_idx" ON "_pages_v_blocks_case_studies_case_studies_results" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_case_studies_case_studies_order_idx" ON "_pages_v_blocks_case_studies_case_studies" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_case_studies_case_studies_parent_id_idx" ON "_pages_v_blocks_case_studies_case_studies" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_case_studies_case_studies_company_logo_idx" ON "_pages_v_blocks_case_studies_case_studies" USING btree ("company_logo_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_case_studies_case_studies_author_author__idx" ON "_pages_v_blocks_case_studies_case_studies" USING btree ("author_avatar_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_case_studies_order_idx" ON "_pages_v_blocks_case_studies" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_case_studies_parent_id_idx" ON "_pages_v_blocks_case_studies" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_case_studies_path_idx" ON "_pages_v_blocks_case_studies" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_marketing_cta_links_order_idx" ON "_pages_v_blocks_marketing_cta_links" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_marketing_cta_links_parent_id_idx" ON "_pages_v_blocks_marketing_cta_links" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_marketing_cta_order_idx" ON "_pages_v_blocks_marketing_cta" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_marketing_cta_parent_id_idx" ON "_pages_v_blocks_marketing_cta" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_marketing_cta_path_idx" ON "_pages_v_blocks_marketing_cta" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_marketing_cta_background_media_idx" ON "_pages_v_blocks_marketing_cta" USING btree ("background_media_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_marketing_hero_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_marketing_hero" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_features_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_case_studies_case_studies_results" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_case_studies_case_studies" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_case_studies" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_marketing_cta_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_marketing_cta" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_marketing_hero_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_marketing_hero" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_features_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_case_studies_case_studies_results" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_case_studies_case_studies" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_case_studies" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_marketing_cta_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_marketing_cta" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_blocks_marketing_hero_links" CASCADE;
  DROP TABLE "pages_blocks_marketing_hero" CASCADE;
  DROP TABLE "pages_blocks_features_features" CASCADE;
  DROP TABLE "pages_blocks_features" CASCADE;
  DROP TABLE "pages_blocks_case_studies_case_studies_results" CASCADE;
  DROP TABLE "pages_blocks_case_studies_case_studies" CASCADE;
  DROP TABLE "pages_blocks_case_studies" CASCADE;
  DROP TABLE "pages_blocks_marketing_cta_links" CASCADE;
  DROP TABLE "pages_blocks_marketing_cta" CASCADE;
  DROP TABLE "_pages_v_blocks_marketing_hero_links" CASCADE;
  DROP TABLE "_pages_v_blocks_marketing_hero" CASCADE;
  DROP TABLE "_pages_v_blocks_features_features" CASCADE;
  DROP TABLE "_pages_v_blocks_features" CASCADE;
  DROP TABLE "_pages_v_blocks_case_studies_case_studies_results" CASCADE;
  DROP TABLE "_pages_v_blocks_case_studies_case_studies" CASCADE;
  DROP TABLE "_pages_v_blocks_case_studies" CASCADE;
  DROP TABLE "_pages_v_blocks_marketing_cta_links" CASCADE;
  DROP TABLE "_pages_v_blocks_marketing_cta" CASCADE;
  ALTER TABLE "tenants_allowed_blocks" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_tenants_allowed_blocks";
  CREATE TYPE "public"."enum_tenants_allowed_blocks" AS ENUM('location', 'healthBenefits', 'sectionTagline', 'faqs', 'mediaBlock', 'archive', 'formBlock', 'threeColumnLayout');
  ALTER TABLE "tenants_allowed_blocks" ALTER COLUMN "value" SET DATA TYPE "public"."enum_tenants_allowed_blocks" USING "value"::"public"."enum_tenants_allowed_blocks";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-02-19T14:59:51.891Z';
  DROP TYPE "public"."enum_pages_blocks_marketing_hero_links_link_type";
  DROP TYPE "public"."enum_pages_blocks_marketing_hero_links_link_appearance";
  DROP TYPE "public"."enum_pages_blocks_marketing_hero_alignment";
  DROP TYPE "public"."enum_pages_blocks_marketing_hero_background_color";
  DROP TYPE "public"."enum_pages_blocks_features_features_link_type";
  DROP TYPE "public"."enum_pages_blocks_features_columns";
  DROP TYPE "public"."enum_pages_blocks_features_background_color";
  DROP TYPE "public"."enum_pages_blocks_case_studies_case_studies_link_type";
  DROP TYPE "public"."enum_pages_blocks_case_studies_layout";
  DROP TYPE "public"."enum_pages_blocks_case_studies_background_color";
  DROP TYPE "public"."enum_pages_blocks_marketing_cta_links_link_type";
  DROP TYPE "public"."enum_pages_blocks_marketing_cta_links_link_appearance";
  DROP TYPE "public"."enum_pages_blocks_marketing_cta_variant";
  DROP TYPE "public"."enum_pages_blocks_marketing_cta_alignment";
  DROP TYPE "public"."enum__pages_v_blocks_marketing_hero_links_link_type";
  DROP TYPE "public"."enum__pages_v_blocks_marketing_hero_links_link_appearance";
  DROP TYPE "public"."enum__pages_v_blocks_marketing_hero_alignment";
  DROP TYPE "public"."enum__pages_v_blocks_marketing_hero_background_color";
  DROP TYPE "public"."enum__pages_v_blocks_features_features_link_type";
  DROP TYPE "public"."enum__pages_v_blocks_features_columns";
  DROP TYPE "public"."enum__pages_v_blocks_features_background_color";
  DROP TYPE "public"."enum__pages_v_blocks_case_studies_case_studies_link_type";
  DROP TYPE "public"."enum__pages_v_blocks_case_studies_layout";
  DROP TYPE "public"."enum__pages_v_blocks_case_studies_background_color";
  DROP TYPE "public"."enum__pages_v_blocks_marketing_cta_links_link_type";
  DROP TYPE "public"."enum__pages_v_blocks_marketing_cta_links_link_appearance";
  DROP TYPE "public"."enum__pages_v_blocks_marketing_cta_variant";
  DROP TYPE "public"."enum__pages_v_blocks_marketing_cta_alignment";`)
}
