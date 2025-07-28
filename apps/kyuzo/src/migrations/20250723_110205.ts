import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "pages_blocks_kids_program_age_groups" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_kids_program" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'Kid''s Program' NOT NULL,
  	"description" varchar DEFAULT 'Our Kid''s classes are designed to get your child more active while having fun through learning Martial Arts' NOT NULL,
  	"image_id" integer NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_adults_program_programs" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_adults_program" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'Adults Program' NOT NULL,
  	"image_id" integer NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_coaching_team_team_members" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" varchar NOT NULL,
  	"bio" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_coaching_team" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'Our Coaching Team' NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_contact_form" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'Want to know more?' NOT NULL,
  	"description" varchar DEFAULT 'Fill out the short form to get in touch' NOT NULL,
  	"form_id" integer NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_latest_posts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  ALTER TABLE "footer_navigation_items" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "footer_navigation_items" CASCADE;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-07-23T11:02:05.409Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-07-23T11:02:05.555Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-07-23T11:02:05.555Z';
  ALTER TABLE "footer" ADD COLUMN "brand_name" varchar DEFAULT 'Kyuzo Brazilian Jiu Jitsu' NOT NULL;
  ALTER TABLE "footer" ADD COLUMN "copyright_text" varchar DEFAULT 'Kyuzo' NOT NULL;
  ALTER TABLE "footer" ADD COLUMN "social_links_facebook" varchar DEFAULT 'https://www.facebook.com/kyuzogym/';
  ALTER TABLE "footer" ADD COLUMN "social_links_twitter" varchar DEFAULT 'https://twitter.com/kyuzogym';
  ALTER TABLE "footer" ADD COLUMN "social_links_instagram" varchar DEFAULT 'https://www.instagram.com/kyuzojiujitsu/';
  ALTER TABLE "footer" ADD COLUMN "social_links_youtube" varchar DEFAULT 'https://www.youtube.com/channel/UCes5Th2Jn9EojMblvqdAKkw';
  ALTER TABLE "pages_blocks_kids_program_age_groups" ADD CONSTRAINT "pages_blocks_kids_program_age_groups_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_kids_program"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_kids_program" ADD CONSTRAINT "pages_blocks_kids_program_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_kids_program" ADD CONSTRAINT "pages_blocks_kids_program_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_adults_program_programs" ADD CONSTRAINT "pages_blocks_adults_program_programs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_adults_program"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_adults_program" ADD CONSTRAINT "pages_blocks_adults_program_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_adults_program" ADD CONSTRAINT "pages_blocks_adults_program_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_coaching_team_team_members" ADD CONSTRAINT "pages_blocks_coaching_team_team_members_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_coaching_team"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_coaching_team" ADD CONSTRAINT "pages_blocks_coaching_team_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_contact_form" ADD CONSTRAINT "pages_blocks_contact_form_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_contact_form" ADD CONSTRAINT "pages_blocks_contact_form_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_latest_posts" ADD CONSTRAINT "pages_blocks_latest_posts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_kids_program_age_groups_order_idx" ON "pages_blocks_kids_program_age_groups" USING btree ("_order");
  CREATE INDEX "pages_blocks_kids_program_age_groups_parent_id_idx" ON "pages_blocks_kids_program_age_groups" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_kids_program_order_idx" ON "pages_blocks_kids_program" USING btree ("_order");
  CREATE INDEX "pages_blocks_kids_program_parent_id_idx" ON "pages_blocks_kids_program" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_kids_program_path_idx" ON "pages_blocks_kids_program" USING btree ("_path");
  CREATE INDEX "pages_blocks_kids_program_image_idx" ON "pages_blocks_kids_program" USING btree ("image_id");
  CREATE INDEX "pages_blocks_adults_program_programs_order_idx" ON "pages_blocks_adults_program_programs" USING btree ("_order");
  CREATE INDEX "pages_blocks_adults_program_programs_parent_id_idx" ON "pages_blocks_adults_program_programs" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_adults_program_order_idx" ON "pages_blocks_adults_program" USING btree ("_order");
  CREATE INDEX "pages_blocks_adults_program_parent_id_idx" ON "pages_blocks_adults_program" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_adults_program_path_idx" ON "pages_blocks_adults_program" USING btree ("_path");
  CREATE INDEX "pages_blocks_adults_program_image_idx" ON "pages_blocks_adults_program" USING btree ("image_id");
  CREATE INDEX "pages_blocks_coaching_team_team_members_order_idx" ON "pages_blocks_coaching_team_team_members" USING btree ("_order");
  CREATE INDEX "pages_blocks_coaching_team_team_members_parent_id_idx" ON "pages_blocks_coaching_team_team_members" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_coaching_team_order_idx" ON "pages_blocks_coaching_team" USING btree ("_order");
  CREATE INDEX "pages_blocks_coaching_team_parent_id_idx" ON "pages_blocks_coaching_team" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_coaching_team_path_idx" ON "pages_blocks_coaching_team" USING btree ("_path");
  CREATE INDEX "pages_blocks_contact_form_order_idx" ON "pages_blocks_contact_form" USING btree ("_order");
  CREATE INDEX "pages_blocks_contact_form_parent_id_idx" ON "pages_blocks_contact_form" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_contact_form_path_idx" ON "pages_blocks_contact_form" USING btree ("_path");
  CREATE INDEX "pages_blocks_contact_form_form_idx" ON "pages_blocks_contact_form" USING btree ("form_id");
  CREATE INDEX "pages_blocks_latest_posts_order_idx" ON "pages_blocks_latest_posts" USING btree ("_order");
  CREATE INDEX "pages_blocks_latest_posts_parent_id_idx" ON "pages_blocks_latest_posts" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_latest_posts_path_idx" ON "pages_blocks_latest_posts" USING btree ("_path");
  ALTER TABLE "footer" DROP COLUMN "logo";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "footer_navigation_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"link" varchar NOT NULL,
  	"is_external" boolean DEFAULT false
  );
  
  ALTER TABLE "pages_blocks_kids_program_age_groups" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_kids_program" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_adults_program_programs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_adults_program" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_coaching_team_team_members" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_coaching_team" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_contact_form" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_latest_posts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_blocks_kids_program_age_groups" CASCADE;
  DROP TABLE "pages_blocks_kids_program" CASCADE;
  DROP TABLE "pages_blocks_adults_program_programs" CASCADE;
  DROP TABLE "pages_blocks_adults_program" CASCADE;
  DROP TABLE "pages_blocks_coaching_team_team_members" CASCADE;
  DROP TABLE "pages_blocks_coaching_team" CASCADE;
  DROP TABLE "pages_blocks_contact_form" CASCADE;
  DROP TABLE "pages_blocks_latest_posts" CASCADE;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-07-22T16:33:20.033Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-07-22T16:33:20.230Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-07-22T16:33:20.230Z';
  ALTER TABLE "footer" ADD COLUMN "logo" varchar DEFAULT 'BRÚ' NOT NULL;
  ALTER TABLE "footer_navigation_items" ADD CONSTRAINT "footer_navigation_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "footer_navigation_items_order_idx" ON "footer_navigation_items" USING btree ("_order");
  CREATE INDEX "footer_navigation_items_parent_id_idx" ON "footer_navigation_items" USING btree ("_parent_id");
  ALTER TABLE "footer" DROP COLUMN "brand_name";
  ALTER TABLE "footer" DROP COLUMN "copyright_text";
  ALTER TABLE "footer" DROP COLUMN "social_links_facebook";
  ALTER TABLE "footer" DROP COLUMN "social_links_twitter";
  ALTER TABLE "footer" DROP COLUMN "social_links_instagram";
  ALTER TABLE "footer" DROP COLUMN "social_links_youtube";`)
}
