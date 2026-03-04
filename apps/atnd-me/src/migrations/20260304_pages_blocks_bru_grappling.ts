import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add Brú Grappling block tables for Pages.
 * These blocks are tenant-scoped extras (see tenants.allowedBlocks).
 *
 * Idempotent: safe to run multiple times.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Enums (select fields)
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_bru_about_sections_image_position" AS ENUM('left', 'right');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  // Main block tables + child array tables
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_bru_hero" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "background_image_id" integer,
      "logo_id" integer,
      "title" varchar,
      "subtitle" varchar,
      "description" varchar,
      "primary_button_text" varchar,
      "primary_button_link" varchar,
      "secondary_button_text" varchar,
      "secondary_button_link" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_bru_about" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_bru_about_sections" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" varchar,
      "content" jsonb,
      "image_id" integer,
      "image_position" "public"."enum_pages_blocks_bru_about_sections_image_position" DEFAULT 'right'
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_bru_schedule" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_bru_learning" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" varchar,
      "content" jsonb,
      "image_id" integer,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_bru_meet_the_team" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_bru_meet_the_team_team_members" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "image_id" integer,
      "name" varchar,
      "role" varchar,
      "bio" jsonb
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_bru_testimonials" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_bru_testimonials_testimonials" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "image_id" integer,
      "name" varchar,
      "role" varchar,
      "testimonial" jsonb
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_bru_contact" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" varchar,
      "description" varchar,
      "form_id" integer,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_bru_hero_waitlist" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "background_image_id" integer,
      "logo_id" integer,
      "title" varchar,
      "subtitle" varchar,
      "description" varchar,
      "form_id" integer,
      "enable_intro" boolean,
      "intro_content" jsonb,
      "block_name" varchar
    );
  `)

  // Version tables (drafts / versions)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_bru_hero" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "background_image_id" integer,
      "logo_id" integer,
      "title" varchar,
      "subtitle" varchar,
      "description" varchar,
      "primary_button_text" varchar,
      "primary_button_link" varchar,
      "secondary_button_text" varchar,
      "secondary_button_link" varchar,
      "_uuid" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_bru_about" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "_uuid" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_bru_about_sections" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar,
      "content" jsonb,
      "image_id" integer,
      "image_position" "public"."enum_pages_blocks_bru_about_sections_image_position" DEFAULT 'right',
      "_uuid" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_bru_schedule" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "_uuid" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_bru_learning" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar,
      "content" jsonb,
      "image_id" integer,
      "_uuid" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_bru_meet_the_team" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "_uuid" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_bru_meet_the_team_team_members" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "image_id" integer,
      "name" varchar,
      "role" varchar,
      "bio" jsonb,
      "_uuid" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_bru_testimonials" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar,
      "_uuid" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_bru_testimonials_testimonials" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "image_id" integer,
      "name" varchar,
      "role" varchar,
      "testimonial" jsonb,
      "_uuid" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_bru_contact" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar,
      "description" varchar,
      "form_id" integer,
      "_uuid" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_bru_hero_waitlist" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "background_image_id" integer,
      "logo_id" integer,
      "title" varchar,
      "subtitle" varchar,
      "description" varchar,
      "form_id" integer,
      "enable_intro" boolean,
      "intro_content" jsonb,
      "_uuid" varchar,
      "block_name" varchar
    );
  `)

  // Indexes
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_hero_order_idx" ON "pages_blocks_bru_hero" ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_hero_parent_id_idx" ON "pages_blocks_bru_hero" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_hero_path_idx" ON "pages_blocks_bru_hero" ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_hero_background_image_idx" ON "pages_blocks_bru_hero" ("background_image_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_hero_logo_idx" ON "pages_blocks_bru_hero" ("logo_id");

    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_about_order_idx" ON "pages_blocks_bru_about" ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_about_parent_id_idx" ON "pages_blocks_bru_about" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_about_path_idx" ON "pages_blocks_bru_about" ("_path");

    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_about_sections_order_idx" ON "pages_blocks_bru_about_sections" ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_about_sections_parent_id_idx" ON "pages_blocks_bru_about_sections" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_about_sections_image_idx" ON "pages_blocks_bru_about_sections" ("image_id");

    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_schedule_order_idx" ON "pages_blocks_bru_schedule" ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_schedule_parent_id_idx" ON "pages_blocks_bru_schedule" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_schedule_path_idx" ON "pages_blocks_bru_schedule" ("_path");

    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_learning_order_idx" ON "pages_blocks_bru_learning" ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_learning_parent_id_idx" ON "pages_blocks_bru_learning" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_learning_path_idx" ON "pages_blocks_bru_learning" ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_learning_image_idx" ON "pages_blocks_bru_learning" ("image_id");

    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_meet_the_team_order_idx" ON "pages_blocks_bru_meet_the_team" ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_meet_the_team_parent_id_idx" ON "pages_blocks_bru_meet_the_team" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_meet_the_team_path_idx" ON "pages_blocks_bru_meet_the_team" ("_path");

    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_meet_the_team_team_members_order_idx" ON "pages_blocks_bru_meet_the_team_team_members" ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_meet_the_team_team_members_parent_id_idx" ON "pages_blocks_bru_meet_the_team_team_members" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_meet_the_team_team_members_image_idx" ON "pages_blocks_bru_meet_the_team_team_members" ("image_id");

    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_testimonials_order_idx" ON "pages_blocks_bru_testimonials" ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_testimonials_parent_id_idx" ON "pages_blocks_bru_testimonials" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_testimonials_path_idx" ON "pages_blocks_bru_testimonials" ("_path");

    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_testimonials_testimonials_order_idx" ON "pages_blocks_bru_testimonials_testimonials" ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_testimonials_testimonials_parent_id_idx" ON "pages_blocks_bru_testimonials_testimonials" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_testimonials_testimonials_image_idx" ON "pages_blocks_bru_testimonials_testimonials" ("image_id");

    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_contact_order_idx" ON "pages_blocks_bru_contact" ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_contact_parent_id_idx" ON "pages_blocks_bru_contact" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_contact_path_idx" ON "pages_blocks_bru_contact" ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_contact_form_idx" ON "pages_blocks_bru_contact" ("form_id");

    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_hero_waitlist_order_idx" ON "pages_blocks_bru_hero_waitlist" ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_hero_waitlist_parent_id_idx" ON "pages_blocks_bru_hero_waitlist" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_hero_waitlist_path_idx" ON "pages_blocks_bru_hero_waitlist" ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_hero_waitlist_background_image_idx" ON "pages_blocks_bru_hero_waitlist" ("background_image_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_hero_waitlist_logo_idx" ON "pages_blocks_bru_hero_waitlist" ("logo_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_bru_hero_waitlist_form_idx" ON "pages_blocks_bru_hero_waitlist" ("form_id");
  `)

  // Foreign keys
  const fkStatements = [
    // pages parent
    `ALTER TABLE "pages_blocks_bru_hero" ADD CONSTRAINT "pages_blocks_bru_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    `ALTER TABLE "pages_blocks_bru_about" ADD CONSTRAINT "pages_blocks_bru_about_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    `ALTER TABLE "pages_blocks_bru_schedule" ADD CONSTRAINT "pages_blocks_bru_schedule_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    `ALTER TABLE "pages_blocks_bru_learning" ADD CONSTRAINT "pages_blocks_bru_learning_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    `ALTER TABLE "pages_blocks_bru_meet_the_team" ADD CONSTRAINT "pages_blocks_bru_meet_the_team_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    `ALTER TABLE "pages_blocks_bru_testimonials" ADD CONSTRAINT "pages_blocks_bru_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    `ALTER TABLE "pages_blocks_bru_contact" ADD CONSTRAINT "pages_blocks_bru_contact_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    `ALTER TABLE "pages_blocks_bru_hero_waitlist" ADD CONSTRAINT "pages_blocks_bru_hero_waitlist_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,

    // media
    `ALTER TABLE "pages_blocks_bru_hero" ADD CONSTRAINT "pages_blocks_bru_hero_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    `ALTER TABLE "pages_blocks_bru_hero" ADD CONSTRAINT "pages_blocks_bru_hero_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    `ALTER TABLE "pages_blocks_bru_about_sections" ADD CONSTRAINT "pages_blocks_bru_about_sections_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    `ALTER TABLE "pages_blocks_bru_learning" ADD CONSTRAINT "pages_blocks_bru_learning_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    `ALTER TABLE "pages_blocks_bru_meet_the_team_team_members" ADD CONSTRAINT "pages_blocks_bru_meet_the_team_team_members_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    `ALTER TABLE "pages_blocks_bru_testimonials_testimonials" ADD CONSTRAINT "pages_blocks_bru_testimonials_testimonials_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    `ALTER TABLE "pages_blocks_bru_hero_waitlist" ADD CONSTRAINT "pages_blocks_bru_hero_waitlist_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    `ALTER TABLE "pages_blocks_bru_hero_waitlist" ADD CONSTRAINT "pages_blocks_bru_hero_waitlist_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,

    // forms
    `ALTER TABLE "pages_blocks_bru_contact" ADD CONSTRAINT "pages_blocks_bru_contact_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    `ALTER TABLE "pages_blocks_bru_hero_waitlist" ADD CONSTRAINT "pages_blocks_bru_hero_waitlist_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,

    // child arrays
    `ALTER TABLE "pages_blocks_bru_about_sections" ADD CONSTRAINT "pages_blocks_bru_about_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_bru_about"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    `ALTER TABLE "pages_blocks_bru_meet_the_team_team_members" ADD CONSTRAINT "pages_blocks_bru_meet_the_team_team_members_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_bru_meet_the_team"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    `ALTER TABLE "pages_blocks_bru_testimonials_testimonials" ADD CONSTRAINT "pages_blocks_bru_testimonials_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_bru_testimonials"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,

    // versions parent
    `ALTER TABLE "_pages_v_blocks_bru_hero" ADD CONSTRAINT "_pages_v_blocks_bru_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    `ALTER TABLE "_pages_v_blocks_bru_about" ADD CONSTRAINT "_pages_v_blocks_bru_about_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    `ALTER TABLE "_pages_v_blocks_bru_schedule" ADD CONSTRAINT "_pages_v_blocks_bru_schedule_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    `ALTER TABLE "_pages_v_blocks_bru_learning" ADD CONSTRAINT "_pages_v_blocks_bru_learning_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    `ALTER TABLE "_pages_v_blocks_bru_meet_the_team" ADD CONSTRAINT "_pages_v_blocks_bru_meet_the_team_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    `ALTER TABLE "_pages_v_blocks_bru_testimonials" ADD CONSTRAINT "_pages_v_blocks_bru_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    `ALTER TABLE "_pages_v_blocks_bru_contact" ADD CONSTRAINT "_pages_v_blocks_bru_contact_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    `ALTER TABLE "_pages_v_blocks_bru_hero_waitlist" ADD CONSTRAINT "_pages_v_blocks_bru_hero_waitlist_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,

    // versions media/forms
    `ALTER TABLE "_pages_v_blocks_bru_hero" ADD CONSTRAINT "_pages_v_blocks_bru_hero_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    `ALTER TABLE "_pages_v_blocks_bru_hero" ADD CONSTRAINT "_pages_v_blocks_bru_hero_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    `ALTER TABLE "_pages_v_blocks_bru_about_sections" ADD CONSTRAINT "_pages_v_blocks_bru_about_sections_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    `ALTER TABLE "_pages_v_blocks_bru_learning" ADD CONSTRAINT "_pages_v_blocks_bru_learning_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    `ALTER TABLE "_pages_v_blocks_bru_meet_the_team_team_members" ADD CONSTRAINT "_pages_v_blocks_bru_meet_the_team_team_members_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    `ALTER TABLE "_pages_v_blocks_bru_testimonials_testimonials" ADD CONSTRAINT "_pages_v_blocks_bru_testimonials_testimonials_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    `ALTER TABLE "_pages_v_blocks_bru_hero_waitlist" ADD CONSTRAINT "_pages_v_blocks_bru_hero_waitlist_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    `ALTER TABLE "_pages_v_blocks_bru_hero_waitlist" ADD CONSTRAINT "_pages_v_blocks_bru_hero_waitlist_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    `ALTER TABLE "_pages_v_blocks_bru_contact" ADD CONSTRAINT "_pages_v_blocks_bru_contact_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    `ALTER TABLE "_pages_v_blocks_bru_hero_waitlist" ADD CONSTRAINT "_pages_v_blocks_bru_hero_waitlist_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,

    // versions child arrays
    `ALTER TABLE "_pages_v_blocks_bru_about_sections" ADD CONSTRAINT "_pages_v_blocks_bru_about_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_bru_about"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    `ALTER TABLE "_pages_v_blocks_bru_meet_the_team_team_members" ADD CONSTRAINT "_pages_v_blocks_bru_meet_the_team_team_members_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_bru_meet_the_team"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    `ALTER TABLE "_pages_v_blocks_bru_testimonials_testimonials" ADD CONSTRAINT "_pages_v_blocks_bru_testimonials_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_bru_testimonials"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  ]

  for (const stmt of fkStatements) {
    await db.execute(sql.raw(`
      DO $$ BEGIN
        ${stmt};
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "_pages_v_blocks_bru_testimonials_testimonials";
    DROP TABLE IF EXISTS "_pages_v_blocks_bru_testimonials";
    DROP TABLE IF EXISTS "_pages_v_blocks_bru_meet_the_team_team_members";
    DROP TABLE IF EXISTS "_pages_v_blocks_bru_meet_the_team";
    DROP TABLE IF EXISTS "_pages_v_blocks_bru_about_sections";
    DROP TABLE IF EXISTS "_pages_v_blocks_bru_about";
    DROP TABLE IF EXISTS "_pages_v_blocks_bru_learning";
    DROP TABLE IF EXISTS "_pages_v_blocks_bru_schedule";
    DROP TABLE IF EXISTS "_pages_v_blocks_bru_contact";
    DROP TABLE IF EXISTS "_pages_v_blocks_bru_hero_waitlist";
    DROP TABLE IF EXISTS "_pages_v_blocks_bru_hero";

    DROP TABLE IF EXISTS "pages_blocks_bru_testimonials_testimonials";
    DROP TABLE IF EXISTS "pages_blocks_bru_testimonials";
    DROP TABLE IF EXISTS "pages_blocks_bru_meet_the_team_team_members";
    DROP TABLE IF EXISTS "pages_blocks_bru_meet_the_team";
    DROP TABLE IF EXISTS "pages_blocks_bru_about_sections";
    DROP TABLE IF EXISTS "pages_blocks_bru_about";
    DROP TABLE IF EXISTS "pages_blocks_bru_learning";
    DROP TABLE IF EXISTS "pages_blocks_bru_schedule";
    DROP TABLE IF EXISTS "pages_blocks_bru_contact";
    DROP TABLE IF EXISTS "pages_blocks_bru_hero_waitlist";
    DROP TABLE IF EXISTS "pages_blocks_bru_hero";

    DROP TYPE IF EXISTS "public"."enum_pages_blocks_bru_about_sections_image_position";
  `)
}

