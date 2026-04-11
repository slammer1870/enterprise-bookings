import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN
  IF to_regclass('public.pages_blocks_dh_hero') IS NULL THEN
   ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE IF NOT EXISTS 'dhHero' BEFORE 'clHeroLoc';
  ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE IF NOT EXISTS 'dhTeam' BEFORE 'clHeroLoc';
  ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE IF NOT EXISTS 'dhTimetable' BEFORE 'clHeroLoc';
  ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE IF NOT EXISTS 'dhTestimonials' BEFORE 'clHeroLoc';
  ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE IF NOT EXISTS 'dhPricing' BEFORE 'clHeroLoc';
  ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE IF NOT EXISTS 'dhContact' BEFORE 'clHeroLoc';
  ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE IF NOT EXISTS 'dhGroups' BEFORE 'clHeroLoc';
  CREATE TABLE "pages_blocks_dh_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'Dark Horse Strength and Performance',
  	"subheading" varchar DEFAULT 'Small Group Personal Training in a Private Facility located in Bray, Co. Wicklow',
  	"background_image_id" integer,
  	"cta_link" varchar DEFAULT '/personal-training',
  	"cta_title" varchar DEFAULT 'Personal Training',
  	"cta_description" varchar DEFAULT 'Do you want to become our next success story? Your own program, nutritional support and expert guidance. Achieve the fitness goals you''ve always dreamed of. Results guaranteed.',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_dh_team_team_members" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"image_id" integer,
  	"bio" varchar
  );
  
  CREATE TABLE "pages_blocks_dh_team_about_content" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"paragraph" varchar
  );
  
  CREATE TABLE "pages_blocks_dh_team" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar DEFAULT 'Meet the Team',
  	"team_image_id" integer,
  	"about_title" varchar DEFAULT 'About Us',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_dh_timetable_time_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"time" varchar,
  	"monday" varchar,
  	"tuesday" varchar,
  	"wednesday" varchar,
  	"thursday" varchar,
  	"friday" varchar,
  	"saturday" varchar,
  	"sunday" varchar
  );
  
  CREATE TABLE "pages_blocks_dh_timetable" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar DEFAULT 'Timetable',
  	"description" varchar DEFAULT 'Check out our class times.',
  	"legend" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_dh_testimonials_videos" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"youtube_id" varchar
  );
  
  CREATE TABLE "pages_blocks_dh_testimonials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar DEFAULT 'Testimonials',
  	"description" varchar DEFAULT 'Here''s what some of our members have to say.',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_dh_pricing_pricing_options_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );
  
  CREATE TABLE "pages_blocks_dh_pricing_pricing_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"price" varchar,
  	"note" varchar DEFAULT 'If you have any questions about membership please contact info@darkhorsestrength.ie'
  );
  
  CREATE TABLE "pages_blocks_dh_pricing" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar DEFAULT 'Pricing',
  	"description" varchar DEFAULT 'We have a range of options to suit your budget and schedule.',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_dh_contact" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"location_title" varchar DEFAULT 'Our Location',
  	"location_description" varchar DEFAULT 'We are located on the end of Florence Road, Bray. Just off the main street. We have multiple public parking spaces available on the road to the gym.',
  	"map_embed_url" varchar DEFAULT 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2389.8115191394754!2d-6.111149684030335!3d53.20329639311717!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4867a9987b9e2e1f%3A0x3551068287b67a29!2sDark%20Horse%20Strength%20%26%20Performance!5e0!3m2!1sen!2sie!4v1651228464827!5m2!1sen!2sie',
  	"address" varchar DEFAULT '17 Main Street, Rear of Bray Co. Wicklow',
  	"email" varchar DEFAULT 'info@darkhorsestrength.ie',
  	"phone" varchar DEFAULT '087 974 8058',
  	"form_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_dh_groups_benefits" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"icon_id" integer,
  	"text" varchar
  );
  
  CREATE TABLE "pages_blocks_dh_groups_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"title" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "pages_blocks_dh_groups" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"hero_image_id" integer,
  	"cta_title" varchar,
  	"cta_description" varchar,
  	"cta_form_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_dh_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'Dark Horse Strength and Performance',
  	"subheading" varchar DEFAULT 'Small Group Personal Training in a Private Facility located in Bray, Co. Wicklow',
  	"background_image_id" integer,
  	"cta_link" varchar DEFAULT '/personal-training',
  	"cta_title" varchar DEFAULT 'Personal Training',
  	"cta_description" varchar DEFAULT 'Do you want to become our next success story? Your own program, nutritional support and expert guidance. Achieve the fitness goals you''ve always dreamed of. Results guaranteed.',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_dh_team_team_members" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"image_id" integer,
  	"bio" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_dh_team_about_content" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"paragraph" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_dh_team" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar DEFAULT 'Meet the Team',
  	"team_image_id" integer,
  	"about_title" varchar DEFAULT 'About Us',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_dh_timetable_time_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"time" varchar,
  	"monday" varchar,
  	"tuesday" varchar,
  	"wednesday" varchar,
  	"thursday" varchar,
  	"friday" varchar,
  	"saturday" varchar,
  	"sunday" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_dh_timetable" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar DEFAULT 'Timetable',
  	"description" varchar DEFAULT 'Check out our class times.',
  	"legend" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_dh_testimonials_videos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"youtube_id" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_dh_testimonials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar DEFAULT 'Testimonials',
  	"description" varchar DEFAULT 'Here''s what some of our members have to say.',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_dh_pricing_pricing_options_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"feature" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_dh_pricing_pricing_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"price" varchar,
  	"note" varchar DEFAULT 'If you have any questions about membership please contact info@darkhorsestrength.ie',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_dh_pricing" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar DEFAULT 'Pricing',
  	"description" varchar DEFAULT 'We have a range of options to suit your budget and schedule.',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_dh_contact" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"location_title" varchar DEFAULT 'Our Location',
  	"location_description" varchar DEFAULT 'We are located on the end of Florence Road, Bray. Just off the main street. We have multiple public parking spaces available on the road to the gym.',
  	"map_embed_url" varchar DEFAULT 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2389.8115191394754!2d-6.111149684030335!3d53.20329639311717!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4867a9987b9e2e1f%3A0x3551068287b67a29!2sDark%20Horse%20Strength%20%26%20Performance!5e0!3m2!1sen!2sie!4v1651228464827!5m2!1sen!2sie',
  	"address" varchar DEFAULT '17 Main Street, Rear of Bray Co. Wicklow',
  	"email" varchar DEFAULT 'info@darkhorsestrength.ie',
  	"phone" varchar DEFAULT '087 974 8058',
  	"form_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_dh_groups_benefits" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"icon_id" integer,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_dh_groups_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"title" varchar,
  	"description" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_dh_groups" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_image_id" integer,
  	"cta_title" varchar,
  	"cta_description" varchar,
  	"cta_form_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "tenant_id" integer;
  ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false;
  ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "time_zone" varchar;
  ALTER TABLE "pages_blocks_dh_hero" ADD CONSTRAINT "pages_blocks_dh_hero_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_dh_hero" ADD CONSTRAINT "pages_blocks_dh_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_dh_team_team_members" ADD CONSTRAINT "pages_blocks_dh_team_team_members_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_dh_team_team_members" ADD CONSTRAINT "pages_blocks_dh_team_team_members_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_dh_team"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_dh_team_about_content" ADD CONSTRAINT "pages_blocks_dh_team_about_content_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_dh_team"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_dh_team" ADD CONSTRAINT "pages_blocks_dh_team_team_image_id_media_id_fk" FOREIGN KEY ("team_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_dh_team" ADD CONSTRAINT "pages_blocks_dh_team_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_dh_timetable_time_slots" ADD CONSTRAINT "pages_blocks_dh_timetable_time_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_dh_timetable"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_dh_timetable" ADD CONSTRAINT "pages_blocks_dh_timetable_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_dh_testimonials_videos" ADD CONSTRAINT "pages_blocks_dh_testimonials_videos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_dh_testimonials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_dh_testimonials" ADD CONSTRAINT "pages_blocks_dh_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_dh_pricing_pricing_options_features" ADD CONSTRAINT "pages_blocks_dh_pricing_pricing_options_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_dh_pricing_pricing_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_dh_pricing_pricing_options" ADD CONSTRAINT "pages_blocks_dh_pricing_pricing_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_dh_pricing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_dh_pricing" ADD CONSTRAINT "pages_blocks_dh_pricing_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_dh_contact" ADD CONSTRAINT "pages_blocks_dh_contact_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_dh_contact" ADD CONSTRAINT "pages_blocks_dh_contact_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_dh_groups_benefits" ADD CONSTRAINT "pages_blocks_dh_groups_benefits_icon_id_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_dh_groups_benefits" ADD CONSTRAINT "pages_blocks_dh_groups_benefits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_dh_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_dh_groups_features" ADD CONSTRAINT "pages_blocks_dh_groups_features_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_dh_groups_features" ADD CONSTRAINT "pages_blocks_dh_groups_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_dh_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_dh_groups" ADD CONSTRAINT "pages_blocks_dh_groups_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_dh_groups" ADD CONSTRAINT "pages_blocks_dh_groups_cta_form_id_forms_id_fk" FOREIGN KEY ("cta_form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_dh_groups" ADD CONSTRAINT "pages_blocks_dh_groups_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_hero" ADD CONSTRAINT "_pages_v_blocks_dh_hero_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_hero" ADD CONSTRAINT "_pages_v_blocks_dh_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_team_team_members" ADD CONSTRAINT "_pages_v_blocks_dh_team_team_members_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_team_team_members" ADD CONSTRAINT "_pages_v_blocks_dh_team_team_members_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_dh_team"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_team_about_content" ADD CONSTRAINT "_pages_v_blocks_dh_team_about_content_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_dh_team"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_team" ADD CONSTRAINT "_pages_v_blocks_dh_team_team_image_id_media_id_fk" FOREIGN KEY ("team_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_team" ADD CONSTRAINT "_pages_v_blocks_dh_team_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_timetable_time_slots" ADD CONSTRAINT "_pages_v_blocks_dh_timetable_time_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_dh_timetable"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_timetable" ADD CONSTRAINT "_pages_v_blocks_dh_timetable_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_testimonials_videos" ADD CONSTRAINT "_pages_v_blocks_dh_testimonials_videos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_dh_testimonials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_testimonials" ADD CONSTRAINT "_pages_v_blocks_dh_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_pricing_pricing_options_features" ADD CONSTRAINT "_pages_v_blocks_dh_pricing_pricing_options_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_dh_pricing_pricing_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_pricing_pricing_options" ADD CONSTRAINT "_pages_v_blocks_dh_pricing_pricing_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_dh_pricing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_pricing" ADD CONSTRAINT "_pages_v_blocks_dh_pricing_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_contact" ADD CONSTRAINT "_pages_v_blocks_dh_contact_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_contact" ADD CONSTRAINT "_pages_v_blocks_dh_contact_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_groups_benefits" ADD CONSTRAINT "_pages_v_blocks_dh_groups_benefits_icon_id_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_groups_benefits" ADD CONSTRAINT "_pages_v_blocks_dh_groups_benefits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_dh_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_groups_features" ADD CONSTRAINT "_pages_v_blocks_dh_groups_features_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_groups_features" ADD CONSTRAINT "_pages_v_blocks_dh_groups_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_dh_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_groups" ADD CONSTRAINT "_pages_v_blocks_dh_groups_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_groups" ADD CONSTRAINT "_pages_v_blocks_dh_groups_cta_form_id_forms_id_fk" FOREIGN KEY ("cta_form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_groups" ADD CONSTRAINT "_pages_v_blocks_dh_groups_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_dh_hero_order_idx" ON "pages_blocks_dh_hero" USING btree ("_order");
  CREATE INDEX "pages_blocks_dh_hero_parent_id_idx" ON "pages_blocks_dh_hero" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_dh_hero_path_idx" ON "pages_blocks_dh_hero" USING btree ("_path");
  CREATE INDEX "pages_blocks_dh_hero_background_image_idx" ON "pages_blocks_dh_hero" USING btree ("background_image_id");
  CREATE INDEX "pages_blocks_dh_team_team_members_order_idx" ON "pages_blocks_dh_team_team_members" USING btree ("_order");
  CREATE INDEX "pages_blocks_dh_team_team_members_parent_id_idx" ON "pages_blocks_dh_team_team_members" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_dh_team_team_members_image_idx" ON "pages_blocks_dh_team_team_members" USING btree ("image_id");
  CREATE INDEX "pages_blocks_dh_team_about_content_order_idx" ON "pages_blocks_dh_team_about_content" USING btree ("_order");
  CREATE INDEX "pages_blocks_dh_team_about_content_parent_id_idx" ON "pages_blocks_dh_team_about_content" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_dh_team_order_idx" ON "pages_blocks_dh_team" USING btree ("_order");
  CREATE INDEX "pages_blocks_dh_team_parent_id_idx" ON "pages_blocks_dh_team" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_dh_team_path_idx" ON "pages_blocks_dh_team" USING btree ("_path");
  CREATE INDEX "pages_blocks_dh_team_team_image_idx" ON "pages_blocks_dh_team" USING btree ("team_image_id");
  CREATE INDEX "pages_blocks_dh_timetable_time_slots_order_idx" ON "pages_blocks_dh_timetable_time_slots" USING btree ("_order");
  CREATE INDEX "pages_blocks_dh_timetable_time_slots_parent_id_idx" ON "pages_blocks_dh_timetable_time_slots" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_dh_timetable_order_idx" ON "pages_blocks_dh_timetable" USING btree ("_order");
  CREATE INDEX "pages_blocks_dh_timetable_parent_id_idx" ON "pages_blocks_dh_timetable" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_dh_timetable_path_idx" ON "pages_blocks_dh_timetable" USING btree ("_path");
  CREATE INDEX "pages_blocks_dh_testimonials_videos_order_idx" ON "pages_blocks_dh_testimonials_videos" USING btree ("_order");
  CREATE INDEX "pages_blocks_dh_testimonials_videos_parent_id_idx" ON "pages_blocks_dh_testimonials_videos" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_dh_testimonials_order_idx" ON "pages_blocks_dh_testimonials" USING btree ("_order");
  CREATE INDEX "pages_blocks_dh_testimonials_parent_id_idx" ON "pages_blocks_dh_testimonials" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_dh_testimonials_path_idx" ON "pages_blocks_dh_testimonials" USING btree ("_path");
  CREATE INDEX "pages_blocks_dh_pricing_pricing_options_features_order_idx" ON "pages_blocks_dh_pricing_pricing_options_features" USING btree ("_order");
  CREATE INDEX "pages_blocks_dh_pricing_pricing_options_features_parent_id_idx" ON "pages_blocks_dh_pricing_pricing_options_features" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_dh_pricing_pricing_options_order_idx" ON "pages_blocks_dh_pricing_pricing_options" USING btree ("_order");
  CREATE INDEX "pages_blocks_dh_pricing_pricing_options_parent_id_idx" ON "pages_blocks_dh_pricing_pricing_options" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_dh_pricing_order_idx" ON "pages_blocks_dh_pricing" USING btree ("_order");
  CREATE INDEX "pages_blocks_dh_pricing_parent_id_idx" ON "pages_blocks_dh_pricing" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_dh_pricing_path_idx" ON "pages_blocks_dh_pricing" USING btree ("_path");
  CREATE INDEX "pages_blocks_dh_contact_order_idx" ON "pages_blocks_dh_contact" USING btree ("_order");
  CREATE INDEX "pages_blocks_dh_contact_parent_id_idx" ON "pages_blocks_dh_contact" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_dh_contact_path_idx" ON "pages_blocks_dh_contact" USING btree ("_path");
  CREATE INDEX "pages_blocks_dh_contact_form_idx" ON "pages_blocks_dh_contact" USING btree ("form_id");
  CREATE INDEX "pages_blocks_dh_groups_benefits_order_idx" ON "pages_blocks_dh_groups_benefits" USING btree ("_order");
  CREATE INDEX "pages_blocks_dh_groups_benefits_parent_id_idx" ON "pages_blocks_dh_groups_benefits" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_dh_groups_benefits_icon_idx" ON "pages_blocks_dh_groups_benefits" USING btree ("icon_id");
  CREATE INDEX "pages_blocks_dh_groups_features_order_idx" ON "pages_blocks_dh_groups_features" USING btree ("_order");
  CREATE INDEX "pages_blocks_dh_groups_features_parent_id_idx" ON "pages_blocks_dh_groups_features" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_dh_groups_features_image_idx" ON "pages_blocks_dh_groups_features" USING btree ("image_id");
  CREATE INDEX "pages_blocks_dh_groups_order_idx" ON "pages_blocks_dh_groups" USING btree ("_order");
  CREATE INDEX "pages_blocks_dh_groups_parent_id_idx" ON "pages_blocks_dh_groups" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_dh_groups_path_idx" ON "pages_blocks_dh_groups" USING btree ("_path");
  CREATE INDEX "pages_blocks_dh_groups_hero_image_idx" ON "pages_blocks_dh_groups" USING btree ("hero_image_id");
  CREATE INDEX "pages_blocks_dh_groups_cta_cta_form_idx" ON "pages_blocks_dh_groups" USING btree ("cta_form_id");
  CREATE INDEX "_pages_v_blocks_dh_hero_order_idx" ON "_pages_v_blocks_dh_hero" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_dh_hero_parent_id_idx" ON "_pages_v_blocks_dh_hero" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_dh_hero_path_idx" ON "_pages_v_blocks_dh_hero" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_dh_hero_background_image_idx" ON "_pages_v_blocks_dh_hero" USING btree ("background_image_id");
  CREATE INDEX "_pages_v_blocks_dh_team_team_members_order_idx" ON "_pages_v_blocks_dh_team_team_members" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_dh_team_team_members_parent_id_idx" ON "_pages_v_blocks_dh_team_team_members" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_dh_team_team_members_image_idx" ON "_pages_v_blocks_dh_team_team_members" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_dh_team_about_content_order_idx" ON "_pages_v_blocks_dh_team_about_content" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_dh_team_about_content_parent_id_idx" ON "_pages_v_blocks_dh_team_about_content" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_dh_team_order_idx" ON "_pages_v_blocks_dh_team" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_dh_team_parent_id_idx" ON "_pages_v_blocks_dh_team" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_dh_team_path_idx" ON "_pages_v_blocks_dh_team" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_dh_team_team_image_idx" ON "_pages_v_blocks_dh_team" USING btree ("team_image_id");
  CREATE INDEX "_pages_v_blocks_dh_timetable_time_slots_order_idx" ON "_pages_v_blocks_dh_timetable_time_slots" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_dh_timetable_time_slots_parent_id_idx" ON "_pages_v_blocks_dh_timetable_time_slots" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_dh_timetable_order_idx" ON "_pages_v_blocks_dh_timetable" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_dh_timetable_parent_id_idx" ON "_pages_v_blocks_dh_timetable" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_dh_timetable_path_idx" ON "_pages_v_blocks_dh_timetable" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_dh_testimonials_videos_order_idx" ON "_pages_v_blocks_dh_testimonials_videos" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_dh_testimonials_videos_parent_id_idx" ON "_pages_v_blocks_dh_testimonials_videos" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_dh_testimonials_order_idx" ON "_pages_v_blocks_dh_testimonials" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_dh_testimonials_parent_id_idx" ON "_pages_v_blocks_dh_testimonials" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_dh_testimonials_path_idx" ON "_pages_v_blocks_dh_testimonials" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_dh_pricing_pricing_options_features_order_idx" ON "_pages_v_blocks_dh_pricing_pricing_options_features" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_dh_pricing_pricing_options_features_parent_id_idx" ON "_pages_v_blocks_dh_pricing_pricing_options_features" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_dh_pricing_pricing_options_order_idx" ON "_pages_v_blocks_dh_pricing_pricing_options" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_dh_pricing_pricing_options_parent_id_idx" ON "_pages_v_blocks_dh_pricing_pricing_options" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_dh_pricing_order_idx" ON "_pages_v_blocks_dh_pricing" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_dh_pricing_parent_id_idx" ON "_pages_v_blocks_dh_pricing" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_dh_pricing_path_idx" ON "_pages_v_blocks_dh_pricing" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_dh_contact_order_idx" ON "_pages_v_blocks_dh_contact" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_dh_contact_parent_id_idx" ON "_pages_v_blocks_dh_contact" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_dh_contact_path_idx" ON "_pages_v_blocks_dh_contact" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_dh_contact_form_idx" ON "_pages_v_blocks_dh_contact" USING btree ("form_id");
  CREATE INDEX "_pages_v_blocks_dh_groups_benefits_order_idx" ON "_pages_v_blocks_dh_groups_benefits" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_dh_groups_benefits_parent_id_idx" ON "_pages_v_blocks_dh_groups_benefits" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_dh_groups_benefits_icon_idx" ON "_pages_v_blocks_dh_groups_benefits" USING btree ("icon_id");
  CREATE INDEX "_pages_v_blocks_dh_groups_features_order_idx" ON "_pages_v_blocks_dh_groups_features" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_dh_groups_features_parent_id_idx" ON "_pages_v_blocks_dh_groups_features" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_dh_groups_features_image_idx" ON "_pages_v_blocks_dh_groups_features" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_dh_groups_order_idx" ON "_pages_v_blocks_dh_groups" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_dh_groups_parent_id_idx" ON "_pages_v_blocks_dh_groups" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_dh_groups_path_idx" ON "_pages_v_blocks_dh_groups" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_dh_groups_hero_image_idx" ON "_pages_v_blocks_dh_groups" USING btree ("hero_image_id");
  CREATE INDEX "_pages_v_blocks_dh_groups_cta_cta_form_idx" ON "_pages_v_blocks_dh_groups" USING btree ("cta_form_id");
  BEGIN
    ALTER TABLE "media" ADD CONSTRAINT "media_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  CREATE INDEX IF NOT EXISTS "media_tenant_idx" ON "media" USING btree ("tenant_id");
  END IF;
  END $$;

  DO $$ BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'timeslots'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'date'
    ) THEN
      ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-03-29T16:22:34.379Z';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'lessons'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'date'
    ) THEN
      ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-03-29T16:22:34.379Z';
    END IF;
  END $$;
`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_dh_hero" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_dh_team_team_members" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_dh_team_about_content" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_dh_team" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_dh_timetable_time_slots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_dh_timetable" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_dh_testimonials_videos" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_dh_testimonials" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_dh_pricing_pricing_options_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_dh_pricing_pricing_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_dh_pricing" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_dh_contact" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_dh_groups_benefits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_dh_groups_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_dh_groups" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_dh_hero" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_dh_team_team_members" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_dh_team_about_content" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_dh_team" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_dh_timetable_time_slots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_dh_timetable" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_dh_testimonials_videos" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_dh_testimonials" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_dh_pricing_pricing_options_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_dh_pricing_pricing_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_dh_pricing" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_dh_contact" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_dh_groups_benefits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_dh_groups_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_dh_groups" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_blocks_dh_hero" CASCADE;
  DROP TABLE "pages_blocks_dh_team_team_members" CASCADE;
  DROP TABLE "pages_blocks_dh_team_about_content" CASCADE;
  DROP TABLE "pages_blocks_dh_team" CASCADE;
  DROP TABLE "pages_blocks_dh_timetable_time_slots" CASCADE;
  DROP TABLE "pages_blocks_dh_timetable" CASCADE;
  DROP TABLE "pages_blocks_dh_testimonials_videos" CASCADE;
  DROP TABLE "pages_blocks_dh_testimonials" CASCADE;
  DROP TABLE "pages_blocks_dh_pricing_pricing_options_features" CASCADE;
  DROP TABLE "pages_blocks_dh_pricing_pricing_options" CASCADE;
  DROP TABLE "pages_blocks_dh_pricing" CASCADE;
  DROP TABLE "pages_blocks_dh_contact" CASCADE;
  DROP TABLE "pages_blocks_dh_groups_benefits" CASCADE;
  DROP TABLE "pages_blocks_dh_groups_features" CASCADE;
  DROP TABLE "pages_blocks_dh_groups" CASCADE;
  DROP TABLE "_pages_v_blocks_dh_hero" CASCADE;
  DROP TABLE "_pages_v_blocks_dh_team_team_members" CASCADE;
  DROP TABLE "_pages_v_blocks_dh_team_about_content" CASCADE;
  DROP TABLE "_pages_v_blocks_dh_team" CASCADE;
  DROP TABLE "_pages_v_blocks_dh_timetable_time_slots" CASCADE;
  DROP TABLE "_pages_v_blocks_dh_timetable" CASCADE;
  DROP TABLE "_pages_v_blocks_dh_testimonials_videos" CASCADE;
  DROP TABLE "_pages_v_blocks_dh_testimonials" CASCADE;
  DROP TABLE "_pages_v_blocks_dh_pricing_pricing_options_features" CASCADE;
  DROP TABLE "_pages_v_blocks_dh_pricing_pricing_options" CASCADE;
  DROP TABLE "_pages_v_blocks_dh_pricing" CASCADE;
  DROP TABLE "_pages_v_blocks_dh_contact" CASCADE;
  DROP TABLE "_pages_v_blocks_dh_groups_benefits" CASCADE;
  DROP TABLE "_pages_v_blocks_dh_groups_features" CASCADE;
  DROP TABLE "_pages_v_blocks_dh_groups" CASCADE;
  ALTER TABLE "media" DROP CONSTRAINT "media_tenant_id_tenants_id_fk";
  
  ALTER TABLE "tenants_allowed_blocks" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_tenants_allowed_blocks";
  CREATE TYPE "public"."enum_tenants_allowed_blocks" AS ENUM('heroWithLocation', 'marketingHero', 'location', 'healthBenefits', 'sectionTagline', 'missionElements', 'faqs', 'features', 'caseStudies', 'marketingCta', 'mediaBlock', 'archive', 'formBlock', 'bruHero', 'bruAbout', 'bruSchedule', 'bruLearning', 'bruMeetTheTeam', 'bruTestimonials', 'bruContact', 'bruHeroWaitlist', 'clHeroLoc', 'threeColumnLayout');
  ALTER TABLE "tenants_allowed_blocks" ALTER COLUMN "value" SET DATA TYPE "public"."enum_tenants_allowed_blocks" USING "value"::"public"."enum_tenants_allowed_blocks";
  DROP INDEX "media_tenant_idx";
  DO $$ BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'timeslots'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'date'
    ) THEN
      ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-03-19T13:17:29.774Z';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'lessons'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'date'
    ) THEN
      ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-03-19T13:17:29.774Z';
    END IF;
  END $$;
  ALTER TABLE "media" DROP COLUMN "tenant_id";
  ALTER TABLE "media" DROP COLUMN "is_public";
  ALTER TABLE "tenants" DROP COLUMN "time_zone";`)
}
