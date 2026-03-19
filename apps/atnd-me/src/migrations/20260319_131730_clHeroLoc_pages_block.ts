import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pages_blocks_bru_about_sections_image_position" AS ENUM('left', 'right');
  CREATE TYPE "public"."enum_pages_blocks_cl_hero_loc_links_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_pages_blocks_cl_hero_loc_links_link_appearance" AS ENUM('default', 'outline');
  CREATE TYPE "public"."enum__pages_v_blocks_bru_about_sections_image_position" AS ENUM('left', 'right');
  CREATE TYPE "public"."enum__pages_v_blocks_cl_hero_loc_links_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum__pages_v_blocks_cl_hero_loc_links_link_appearance" AS ENUM('default', 'outline');
  CREATE TYPE "public"."enum_footer_nav_items_icon" AS ENUM('none', 'instagram', 'facebook', 'x', 'location');
  CREATE TYPE "public"."enum_footer_styling_padding" AS ENUM('small', 'medium', 'large');
  ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE 'heroWithLocation' BEFORE 'marketingHero';
  ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE 'missionElements' BEFORE 'faqs';
  ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE 'clHeroLoc' BEFORE 'threeColumnLayout';
  CREATE TABLE "pages_blocks_bru_hero" (
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
  
  CREATE TABLE "pages_blocks_bru_about_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"content" jsonb,
  	"image_id" integer,
  	"image_position" "enum_pages_blocks_bru_about_sections_image_position" DEFAULT 'right'
  );
  
  CREATE TABLE "pages_blocks_bru_about" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_bru_schedule" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_bru_learning" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"content" jsonb,
  	"image_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_bru_meet_the_team_team_members" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"name" varchar,
  	"role" varchar,
  	"bio" jsonb
  );
  
  CREATE TABLE "pages_blocks_bru_meet_the_team" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_bru_testimonials_testimonials" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"name" varchar,
  	"role" varchar,
  	"testimonial" jsonb
  );
  
  CREATE TABLE "pages_blocks_bru_testimonials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_bru_contact" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"form_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_bru_hero_waitlist" (
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
  
  CREATE TABLE "pages_blocks_cl_hero_loc_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_pages_blocks_cl_hero_loc_links_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_appearance" "enum_pages_blocks_cl_hero_loc_links_link_appearance" DEFAULT 'default'
  );
  
  CREATE TABLE "pages_blocks_cl_hero_loc" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"background_image_id" integer,
  	"image_overlay_hex" varchar,
  	"image_overlay_opacity" numeric DEFAULT 70,
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
  
  CREATE TABLE "_pages_v_blocks_bru_hero" (
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
  
  CREATE TABLE "_pages_v_blocks_bru_about_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"content" jsonb,
  	"image_id" integer,
  	"image_position" "enum__pages_v_blocks_bru_about_sections_image_position" DEFAULT 'right',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_bru_about" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_bru_schedule" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_bru_learning" (
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
  
  CREATE TABLE "_pages_v_blocks_bru_meet_the_team_team_members" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"name" varchar,
  	"role" varchar,
  	"bio" jsonb,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_bru_meet_the_team" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_bru_testimonials_testimonials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"name" varchar,
  	"role" varchar,
  	"testimonial" jsonb,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_bru_testimonials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_bru_contact" (
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
  
  CREATE TABLE "_pages_v_blocks_bru_hero_waitlist" (
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
  
  CREATE TABLE "_pages_v_blocks_cl_hero_loc_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"link_type" "enum__pages_v_blocks_cl_hero_loc_links_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_appearance" "enum__pages_v_blocks_cl_hero_loc_links_link_appearance" DEFAULT 'default',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_cl_hero_loc" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"background_image_id" integer,
  	"image_overlay_hex" varchar,
  	"image_overlay_opacity" numeric DEFAULT 70,
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
  
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-03-19T13:17:29.774Z';
  ALTER TABLE "plans" ALTER COLUMN "sessions_information_allow_multiple_bookings_per_lesson" SET NOT NULL;
  ALTER TABLE "footer_nav_items" ADD COLUMN "icon" "enum_footer_nav_items_icon" DEFAULT 'none';
  ALTER TABLE "footer" ADD COLUMN "styling_padding" "enum_footer_styling_padding" DEFAULT 'medium';
  ALTER TABLE "pages_blocks_bru_hero" ADD CONSTRAINT "pages_blocks_bru_hero_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_bru_hero" ADD CONSTRAINT "pages_blocks_bru_hero_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_bru_hero" ADD CONSTRAINT "pages_blocks_bru_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_bru_about_sections" ADD CONSTRAINT "pages_blocks_bru_about_sections_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_bru_about_sections" ADD CONSTRAINT "pages_blocks_bru_about_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_bru_about"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_bru_about" ADD CONSTRAINT "pages_blocks_bru_about_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_bru_schedule" ADD CONSTRAINT "pages_blocks_bru_schedule_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_bru_learning" ADD CONSTRAINT "pages_blocks_bru_learning_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_bru_learning" ADD CONSTRAINT "pages_blocks_bru_learning_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_bru_meet_the_team_team_members" ADD CONSTRAINT "pages_blocks_bru_meet_the_team_team_members_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_bru_meet_the_team_team_members" ADD CONSTRAINT "pages_blocks_bru_meet_the_team_team_members_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_bru_meet_the_team"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_bru_meet_the_team" ADD CONSTRAINT "pages_blocks_bru_meet_the_team_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_bru_testimonials_testimonials" ADD CONSTRAINT "pages_blocks_bru_testimonials_testimonials_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_bru_testimonials_testimonials" ADD CONSTRAINT "pages_blocks_bru_testimonials_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_bru_testimonials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_bru_testimonials" ADD CONSTRAINT "pages_blocks_bru_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_bru_contact" ADD CONSTRAINT "pages_blocks_bru_contact_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_bru_contact" ADD CONSTRAINT "pages_blocks_bru_contact_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_bru_hero_waitlist" ADD CONSTRAINT "pages_blocks_bru_hero_waitlist_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_bru_hero_waitlist" ADD CONSTRAINT "pages_blocks_bru_hero_waitlist_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_bru_hero_waitlist" ADD CONSTRAINT "pages_blocks_bru_hero_waitlist_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_bru_hero_waitlist" ADD CONSTRAINT "pages_blocks_bru_hero_waitlist_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_cl_hero_loc_links" ADD CONSTRAINT "pages_blocks_cl_hero_loc_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_cl_hero_loc"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_cl_hero_loc" ADD CONSTRAINT "pages_blocks_cl_hero_loc_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_cl_hero_loc" ADD CONSTRAINT "pages_blocks_cl_hero_loc_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_cl_hero_loc" ADD CONSTRAINT "pages_blocks_cl_hero_loc_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_bru_hero" ADD CONSTRAINT "_pages_v_blocks_bru_hero_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_bru_hero" ADD CONSTRAINT "_pages_v_blocks_bru_hero_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_bru_hero" ADD CONSTRAINT "_pages_v_blocks_bru_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_bru_about_sections" ADD CONSTRAINT "_pages_v_blocks_bru_about_sections_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_bru_about_sections" ADD CONSTRAINT "_pages_v_blocks_bru_about_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_bru_about"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_bru_about" ADD CONSTRAINT "_pages_v_blocks_bru_about_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_bru_schedule" ADD CONSTRAINT "_pages_v_blocks_bru_schedule_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_bru_learning" ADD CONSTRAINT "_pages_v_blocks_bru_learning_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_bru_learning" ADD CONSTRAINT "_pages_v_blocks_bru_learning_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_bru_meet_the_team_team_members" ADD CONSTRAINT "_pages_v_blocks_bru_meet_the_team_team_members_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_bru_meet_the_team_team_members" ADD CONSTRAINT "_pages_v_blocks_bru_meet_the_team_team_members_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_bru_meet_the_team"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_bru_meet_the_team" ADD CONSTRAINT "_pages_v_blocks_bru_meet_the_team_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_bru_testimonials_testimonials" ADD CONSTRAINT "_pages_v_blocks_bru_testimonials_testimonials_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_bru_testimonials_testimonials" ADD CONSTRAINT "_pages_v_blocks_bru_testimonials_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_bru_testimonials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_bru_testimonials" ADD CONSTRAINT "_pages_v_blocks_bru_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_bru_contact" ADD CONSTRAINT "_pages_v_blocks_bru_contact_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_bru_contact" ADD CONSTRAINT "_pages_v_blocks_bru_contact_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_bru_hero_waitlist" ADD CONSTRAINT "_pages_v_blocks_bru_hero_waitlist_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_bru_hero_waitlist" ADD CONSTRAINT "_pages_v_blocks_bru_hero_waitlist_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_bru_hero_waitlist" ADD CONSTRAINT "_pages_v_blocks_bru_hero_waitlist_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_bru_hero_waitlist" ADD CONSTRAINT "_pages_v_blocks_bru_hero_waitlist_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_cl_hero_loc_links" ADD CONSTRAINT "_pages_v_blocks_cl_hero_loc_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_cl_hero_loc"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_cl_hero_loc" ADD CONSTRAINT "_pages_v_blocks_cl_hero_loc_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_cl_hero_loc" ADD CONSTRAINT "_pages_v_blocks_cl_hero_loc_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_cl_hero_loc" ADD CONSTRAINT "_pages_v_blocks_cl_hero_loc_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_bru_hero_order_idx" ON "pages_blocks_bru_hero" USING btree ("_order");
  CREATE INDEX "pages_blocks_bru_hero_parent_id_idx" ON "pages_blocks_bru_hero" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_bru_hero_path_idx" ON "pages_blocks_bru_hero" USING btree ("_path");
  CREATE INDEX "pages_blocks_bru_hero_background_image_idx" ON "pages_blocks_bru_hero" USING btree ("background_image_id");
  CREATE INDEX "pages_blocks_bru_hero_logo_idx" ON "pages_blocks_bru_hero" USING btree ("logo_id");
  CREATE INDEX "pages_blocks_bru_about_sections_order_idx" ON "pages_blocks_bru_about_sections" USING btree ("_order");
  CREATE INDEX "pages_blocks_bru_about_sections_parent_id_idx" ON "pages_blocks_bru_about_sections" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_bru_about_sections_image_idx" ON "pages_blocks_bru_about_sections" USING btree ("image_id");
  CREATE INDEX "pages_blocks_bru_about_order_idx" ON "pages_blocks_bru_about" USING btree ("_order");
  CREATE INDEX "pages_blocks_bru_about_parent_id_idx" ON "pages_blocks_bru_about" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_bru_about_path_idx" ON "pages_blocks_bru_about" USING btree ("_path");
  CREATE INDEX "pages_blocks_bru_schedule_order_idx" ON "pages_blocks_bru_schedule" USING btree ("_order");
  CREATE INDEX "pages_blocks_bru_schedule_parent_id_idx" ON "pages_blocks_bru_schedule" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_bru_schedule_path_idx" ON "pages_blocks_bru_schedule" USING btree ("_path");
  CREATE INDEX "pages_blocks_bru_learning_order_idx" ON "pages_blocks_bru_learning" USING btree ("_order");
  CREATE INDEX "pages_blocks_bru_learning_parent_id_idx" ON "pages_blocks_bru_learning" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_bru_learning_path_idx" ON "pages_blocks_bru_learning" USING btree ("_path");
  CREATE INDEX "pages_blocks_bru_learning_image_idx" ON "pages_blocks_bru_learning" USING btree ("image_id");
  CREATE INDEX "pages_blocks_bru_meet_the_team_team_members_order_idx" ON "pages_blocks_bru_meet_the_team_team_members" USING btree ("_order");
  CREATE INDEX "pages_blocks_bru_meet_the_team_team_members_parent_id_idx" ON "pages_blocks_bru_meet_the_team_team_members" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_bru_meet_the_team_team_members_image_idx" ON "pages_blocks_bru_meet_the_team_team_members" USING btree ("image_id");
  CREATE INDEX "pages_blocks_bru_meet_the_team_order_idx" ON "pages_blocks_bru_meet_the_team" USING btree ("_order");
  CREATE INDEX "pages_blocks_bru_meet_the_team_parent_id_idx" ON "pages_blocks_bru_meet_the_team" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_bru_meet_the_team_path_idx" ON "pages_blocks_bru_meet_the_team" USING btree ("_path");
  CREATE INDEX "pages_blocks_bru_testimonials_testimonials_order_idx" ON "pages_blocks_bru_testimonials_testimonials" USING btree ("_order");
  CREATE INDEX "pages_blocks_bru_testimonials_testimonials_parent_id_idx" ON "pages_blocks_bru_testimonials_testimonials" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_bru_testimonials_testimonials_image_idx" ON "pages_blocks_bru_testimonials_testimonials" USING btree ("image_id");
  CREATE INDEX "pages_blocks_bru_testimonials_order_idx" ON "pages_blocks_bru_testimonials" USING btree ("_order");
  CREATE INDEX "pages_blocks_bru_testimonials_parent_id_idx" ON "pages_blocks_bru_testimonials" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_bru_testimonials_path_idx" ON "pages_blocks_bru_testimonials" USING btree ("_path");
  CREATE INDEX "pages_blocks_bru_contact_order_idx" ON "pages_blocks_bru_contact" USING btree ("_order");
  CREATE INDEX "pages_blocks_bru_contact_parent_id_idx" ON "pages_blocks_bru_contact" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_bru_contact_path_idx" ON "pages_blocks_bru_contact" USING btree ("_path");
  CREATE INDEX "pages_blocks_bru_contact_form_idx" ON "pages_blocks_bru_contact" USING btree ("form_id");
  CREATE INDEX "pages_blocks_bru_hero_waitlist_order_idx" ON "pages_blocks_bru_hero_waitlist" USING btree ("_order");
  CREATE INDEX "pages_blocks_bru_hero_waitlist_parent_id_idx" ON "pages_blocks_bru_hero_waitlist" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_bru_hero_waitlist_path_idx" ON "pages_blocks_bru_hero_waitlist" USING btree ("_path");
  CREATE INDEX "pages_blocks_bru_hero_waitlist_background_image_idx" ON "pages_blocks_bru_hero_waitlist" USING btree ("background_image_id");
  CREATE INDEX "pages_blocks_bru_hero_waitlist_logo_idx" ON "pages_blocks_bru_hero_waitlist" USING btree ("logo_id");
  CREATE INDEX "pages_blocks_bru_hero_waitlist_form_idx" ON "pages_blocks_bru_hero_waitlist" USING btree ("form_id");
  CREATE INDEX "pages_blocks_cl_hero_loc_links_order_idx" ON "pages_blocks_cl_hero_loc_links" USING btree ("_order");
  CREATE INDEX "pages_blocks_cl_hero_loc_links_parent_id_idx" ON "pages_blocks_cl_hero_loc_links" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_cl_hero_loc_order_idx" ON "pages_blocks_cl_hero_loc" USING btree ("_order");
  CREATE INDEX "pages_blocks_cl_hero_loc_parent_id_idx" ON "pages_blocks_cl_hero_loc" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_cl_hero_loc_path_idx" ON "pages_blocks_cl_hero_loc" USING btree ("_path");
  CREATE INDEX "pages_blocks_cl_hero_loc_background_image_idx" ON "pages_blocks_cl_hero_loc" USING btree ("background_image_id");
  CREATE INDEX "pages_blocks_cl_hero_loc_logo_idx" ON "pages_blocks_cl_hero_loc" USING btree ("logo_id");
  CREATE INDEX "_pages_v_blocks_bru_hero_order_idx" ON "_pages_v_blocks_bru_hero" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_bru_hero_parent_id_idx" ON "_pages_v_blocks_bru_hero" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_bru_hero_path_idx" ON "_pages_v_blocks_bru_hero" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_bru_hero_background_image_idx" ON "_pages_v_blocks_bru_hero" USING btree ("background_image_id");
  CREATE INDEX "_pages_v_blocks_bru_hero_logo_idx" ON "_pages_v_blocks_bru_hero" USING btree ("logo_id");
  CREATE INDEX "_pages_v_blocks_bru_about_sections_order_idx" ON "_pages_v_blocks_bru_about_sections" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_bru_about_sections_parent_id_idx" ON "_pages_v_blocks_bru_about_sections" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_bru_about_sections_image_idx" ON "_pages_v_blocks_bru_about_sections" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_bru_about_order_idx" ON "_pages_v_blocks_bru_about" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_bru_about_parent_id_idx" ON "_pages_v_blocks_bru_about" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_bru_about_path_idx" ON "_pages_v_blocks_bru_about" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_bru_schedule_order_idx" ON "_pages_v_blocks_bru_schedule" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_bru_schedule_parent_id_idx" ON "_pages_v_blocks_bru_schedule" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_bru_schedule_path_idx" ON "_pages_v_blocks_bru_schedule" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_bru_learning_order_idx" ON "_pages_v_blocks_bru_learning" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_bru_learning_parent_id_idx" ON "_pages_v_blocks_bru_learning" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_bru_learning_path_idx" ON "_pages_v_blocks_bru_learning" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_bru_learning_image_idx" ON "_pages_v_blocks_bru_learning" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_bru_meet_the_team_team_members_order_idx" ON "_pages_v_blocks_bru_meet_the_team_team_members" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_bru_meet_the_team_team_members_parent_id_idx" ON "_pages_v_blocks_bru_meet_the_team_team_members" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_bru_meet_the_team_team_members_image_idx" ON "_pages_v_blocks_bru_meet_the_team_team_members" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_bru_meet_the_team_order_idx" ON "_pages_v_blocks_bru_meet_the_team" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_bru_meet_the_team_parent_id_idx" ON "_pages_v_blocks_bru_meet_the_team" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_bru_meet_the_team_path_idx" ON "_pages_v_blocks_bru_meet_the_team" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_bru_testimonials_testimonials_order_idx" ON "_pages_v_blocks_bru_testimonials_testimonials" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_bru_testimonials_testimonials_parent_id_idx" ON "_pages_v_blocks_bru_testimonials_testimonials" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_bru_testimonials_testimonials_image_idx" ON "_pages_v_blocks_bru_testimonials_testimonials" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_bru_testimonials_order_idx" ON "_pages_v_blocks_bru_testimonials" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_bru_testimonials_parent_id_idx" ON "_pages_v_blocks_bru_testimonials" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_bru_testimonials_path_idx" ON "_pages_v_blocks_bru_testimonials" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_bru_contact_order_idx" ON "_pages_v_blocks_bru_contact" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_bru_contact_parent_id_idx" ON "_pages_v_blocks_bru_contact" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_bru_contact_path_idx" ON "_pages_v_blocks_bru_contact" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_bru_contact_form_idx" ON "_pages_v_blocks_bru_contact" USING btree ("form_id");
  CREATE INDEX "_pages_v_blocks_bru_hero_waitlist_order_idx" ON "_pages_v_blocks_bru_hero_waitlist" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_bru_hero_waitlist_parent_id_idx" ON "_pages_v_blocks_bru_hero_waitlist" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_bru_hero_waitlist_path_idx" ON "_pages_v_blocks_bru_hero_waitlist" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_bru_hero_waitlist_background_image_idx" ON "_pages_v_blocks_bru_hero_waitlist" USING btree ("background_image_id");
  CREATE INDEX "_pages_v_blocks_bru_hero_waitlist_logo_idx" ON "_pages_v_blocks_bru_hero_waitlist" USING btree ("logo_id");
  CREATE INDEX "_pages_v_blocks_bru_hero_waitlist_form_idx" ON "_pages_v_blocks_bru_hero_waitlist" USING btree ("form_id");
  CREATE INDEX "_pages_v_blocks_cl_hero_loc_links_order_idx" ON "_pages_v_blocks_cl_hero_loc_links" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_cl_hero_loc_links_parent_id_idx" ON "_pages_v_blocks_cl_hero_loc_links" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_cl_hero_loc_order_idx" ON "_pages_v_blocks_cl_hero_loc" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_cl_hero_loc_parent_id_idx" ON "_pages_v_blocks_cl_hero_loc" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_cl_hero_loc_path_idx" ON "_pages_v_blocks_cl_hero_loc" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_cl_hero_loc_background_image_idx" ON "_pages_v_blocks_cl_hero_loc" USING btree ("background_image_id");
  CREATE INDEX "_pages_v_blocks_cl_hero_loc_logo_idx" ON "_pages_v_blocks_cl_hero_loc" USING btree ("logo_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_bru_hero" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_bru_about_sections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_bru_about" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_bru_schedule" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_bru_learning" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_bru_meet_the_team_team_members" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_bru_meet_the_team" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_bru_testimonials_testimonials" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_bru_testimonials" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_bru_contact" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_bru_hero_waitlist" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_cl_hero_loc_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_cl_hero_loc" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_bru_hero" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_bru_about_sections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_bru_about" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_bru_schedule" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_bru_learning" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_bru_meet_the_team_team_members" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_bru_meet_the_team" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_bru_testimonials_testimonials" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_bru_testimonials" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_bru_contact" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_bru_hero_waitlist" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_cl_hero_loc_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_cl_hero_loc" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_blocks_bru_hero" CASCADE;
  DROP TABLE "pages_blocks_bru_about_sections" CASCADE;
  DROP TABLE "pages_blocks_bru_about" CASCADE;
  DROP TABLE "pages_blocks_bru_schedule" CASCADE;
  DROP TABLE "pages_blocks_bru_learning" CASCADE;
  DROP TABLE "pages_blocks_bru_meet_the_team_team_members" CASCADE;
  DROP TABLE "pages_blocks_bru_meet_the_team" CASCADE;
  DROP TABLE "pages_blocks_bru_testimonials_testimonials" CASCADE;
  DROP TABLE "pages_blocks_bru_testimonials" CASCADE;
  DROP TABLE "pages_blocks_bru_contact" CASCADE;
  DROP TABLE "pages_blocks_bru_hero_waitlist" CASCADE;
  DROP TABLE "pages_blocks_cl_hero_loc_links" CASCADE;
  DROP TABLE "pages_blocks_cl_hero_loc" CASCADE;
  DROP TABLE "_pages_v_blocks_bru_hero" CASCADE;
  DROP TABLE "_pages_v_blocks_bru_about_sections" CASCADE;
  DROP TABLE "_pages_v_blocks_bru_about" CASCADE;
  DROP TABLE "_pages_v_blocks_bru_schedule" CASCADE;
  DROP TABLE "_pages_v_blocks_bru_learning" CASCADE;
  DROP TABLE "_pages_v_blocks_bru_meet_the_team_team_members" CASCADE;
  DROP TABLE "_pages_v_blocks_bru_meet_the_team" CASCADE;
  DROP TABLE "_pages_v_blocks_bru_testimonials_testimonials" CASCADE;
  DROP TABLE "_pages_v_blocks_bru_testimonials" CASCADE;
  DROP TABLE "_pages_v_blocks_bru_contact" CASCADE;
  DROP TABLE "_pages_v_blocks_bru_hero_waitlist" CASCADE;
  DROP TABLE "_pages_v_blocks_cl_hero_loc_links" CASCADE;
  DROP TABLE "_pages_v_blocks_cl_hero_loc" CASCADE;
  ALTER TABLE "tenants_allowed_blocks" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_tenants_allowed_blocks";
  CREATE TYPE "public"."enum_tenants_allowed_blocks" AS ENUM('marketingHero', 'location', 'healthBenefits', 'sectionTagline', 'faqs', 'features', 'caseStudies', 'marketingCta', 'mediaBlock', 'archive', 'formBlock', 'bruHero', 'bruAbout', 'bruSchedule', 'bruLearning', 'bruMeetTheTeam', 'bruTestimonials', 'bruContact', 'bruHeroWaitlist', 'threeColumnLayout');
  ALTER TABLE "tenants_allowed_blocks" ALTER COLUMN "value" SET DATA TYPE "public"."enum_tenants_allowed_blocks" USING "value"::"public"."enum_tenants_allowed_blocks";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-02-27T11:11:21.739Z';
  ALTER TABLE "plans" ALTER COLUMN "sessions_information_allow_multiple_bookings_per_lesson" DROP NOT NULL;
  ALTER TABLE "footer_nav_items" DROP COLUMN "icon";
  ALTER TABLE "footer" DROP COLUMN "styling_padding";
  DROP TYPE "public"."enum_pages_blocks_bru_about_sections_image_position";
  DROP TYPE "public"."enum_pages_blocks_cl_hero_loc_links_link_type";
  DROP TYPE "public"."enum_pages_blocks_cl_hero_loc_links_link_appearance";
  DROP TYPE "public"."enum__pages_v_blocks_bru_about_sections_image_position";
  DROP TYPE "public"."enum__pages_v_blocks_cl_hero_loc_links_link_type";
  DROP TYPE "public"."enum__pages_v_blocks_cl_hero_loc_links_link_appearance";
  DROP TYPE "public"."enum_footer_nav_items_icon";
  DROP TYPE "public"."enum_footer_styling_padding";`)
}
