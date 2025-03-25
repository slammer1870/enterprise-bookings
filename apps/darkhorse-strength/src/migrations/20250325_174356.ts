import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE IF NOT EXISTS "pages_blocks_team_team_members" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"image_id" integer NOT NULL,
  	"bio" varchar NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "pages_blocks_team_about_content" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"paragraph" varchar NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "pages_blocks_team" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar DEFAULT 'Meet the Team' NOT NULL,
  	"team_image_id" integer NOT NULL,
  	"about_title" varchar DEFAULT 'About Us' NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "pages_blocks_timetable_time_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"time" varchar NOT NULL,
  	"monday" varchar,
  	"tuesday" varchar,
  	"wednesday" varchar,
  	"thursday" varchar,
  	"friday" varchar,
  	"saturday" varchar,
  	"sunday" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "pages_blocks_timetable" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar DEFAULT 'Timetable' NOT NULL,
  	"description" varchar DEFAULT 'Check out our class times.' NOT NULL,
  	"legend" varchar NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "pages_blocks_testimonials_videos" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"youtube_id" varchar NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "pages_blocks_testimonials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar DEFAULT 'Testimonials' NOT NULL,
  	"description" varchar DEFAULT 'Here''''s what some of our members have to say.' NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "pages_blocks_pricing_pricing_options_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "pages_blocks_pricing_pricing_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"price" varchar NOT NULL,
  	"note" varchar DEFAULT 'If you have any questions about membership please contact info@darkhorsestrength.ie'
  );
  
  CREATE TABLE IF NOT EXISTS "pages_blocks_pricing" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar DEFAULT 'Pricing' NOT NULL,
  	"description" varchar DEFAULT 'We have a range of options to suit your budget and schedule.' NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "pages_blocks_contact" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"location_title" varchar DEFAULT 'Our Location' NOT NULL,
  	"location_description" varchar DEFAULT 'We are located on the end of Florence Road, Bray. Just off the main street. We have multiple public parking spaces available on the road to the gym.' NOT NULL,
  	"map_embed_url" varchar DEFAULT 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2389.8115191394754!2d-6.111149684030335!3d53.20329639311717!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4867a9987b9e2e1f%3A0x3551068287b67a29!2sDark%20Horse%20Strength%20%26%20Performance!5e0!3m2!1sen!2sie!4v1651228464827!5m2!1sen!2sie' NOT NULL,
  	"address" varchar DEFAULT '17 Main Street, Rear of Bray Co. Wicklow' NOT NULL,
  	"email" varchar DEFAULT 'info@darkhorsestrength.ie' NOT NULL,
  	"phone" varchar DEFAULT '087 974 8058' NOT NULL,
  	"contact_title" varchar DEFAULT 'Contact Us' NOT NULL,
  	"contact_description" varchar DEFAULT 'Do you have any questions? Fill in our contact form and we will get back to you as soon as possible!' NOT NULL,
  	"block_name" varchar
  );
  
  DO $$ BEGIN
   ALTER TABLE "pages_blocks_team_team_members" ADD CONSTRAINT "pages_blocks_team_team_members_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "pages_blocks_team_team_members" ADD CONSTRAINT "pages_blocks_team_team_members_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_team"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "pages_blocks_team_about_content" ADD CONSTRAINT "pages_blocks_team_about_content_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_team"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "pages_blocks_team" ADD CONSTRAINT "pages_blocks_team_team_image_id_media_id_fk" FOREIGN KEY ("team_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "pages_blocks_team" ADD CONSTRAINT "pages_blocks_team_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "pages_blocks_timetable_time_slots" ADD CONSTRAINT "pages_blocks_timetable_time_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_timetable"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "pages_blocks_timetable" ADD CONSTRAINT "pages_blocks_timetable_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "pages_blocks_testimonials_videos" ADD CONSTRAINT "pages_blocks_testimonials_videos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_testimonials"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "pages_blocks_testimonials" ADD CONSTRAINT "pages_blocks_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "pages_blocks_pricing_pricing_options_features" ADD CONSTRAINT "pages_blocks_pricing_pricing_options_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_pricing_pricing_options"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "pages_blocks_pricing_pricing_options" ADD CONSTRAINT "pages_blocks_pricing_pricing_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_pricing"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "pages_blocks_pricing" ADD CONSTRAINT "pages_blocks_pricing_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "pages_blocks_contact" ADD CONSTRAINT "pages_blocks_contact_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "pages_blocks_team_team_members_order_idx" ON "pages_blocks_team_team_members" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_team_team_members_parent_id_idx" ON "pages_blocks_team_team_members" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_team_team_members_image_idx" ON "pages_blocks_team_team_members" USING btree ("image_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_team_about_content_order_idx" ON "pages_blocks_team_about_content" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_team_about_content_parent_id_idx" ON "pages_blocks_team_about_content" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_team_order_idx" ON "pages_blocks_team" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_team_parent_id_idx" ON "pages_blocks_team" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_team_path_idx" ON "pages_blocks_team" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_team_team_image_idx" ON "pages_blocks_team" USING btree ("team_image_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_timetable_time_slots_order_idx" ON "pages_blocks_timetable_time_slots" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_timetable_time_slots_parent_id_idx" ON "pages_blocks_timetable_time_slots" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_timetable_order_idx" ON "pages_blocks_timetable" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_timetable_parent_id_idx" ON "pages_blocks_timetable" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_timetable_path_idx" ON "pages_blocks_timetable" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_testimonials_videos_order_idx" ON "pages_blocks_testimonials_videos" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_testimonials_videos_parent_id_idx" ON "pages_blocks_testimonials_videos" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_testimonials_order_idx" ON "pages_blocks_testimonials" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_testimonials_parent_id_idx" ON "pages_blocks_testimonials" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_testimonials_path_idx" ON "pages_blocks_testimonials" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_pricing_pricing_options_features_order_idx" ON "pages_blocks_pricing_pricing_options_features" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_pricing_pricing_options_features_parent_id_idx" ON "pages_blocks_pricing_pricing_options_features" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_pricing_pricing_options_order_idx" ON "pages_blocks_pricing_pricing_options" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_pricing_pricing_options_parent_id_idx" ON "pages_blocks_pricing_pricing_options" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_pricing_order_idx" ON "pages_blocks_pricing" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_pricing_parent_id_idx" ON "pages_blocks_pricing" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_pricing_path_idx" ON "pages_blocks_pricing" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "pages_blocks_contact_order_idx" ON "pages_blocks_contact" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_contact_parent_id_idx" ON "pages_blocks_contact" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_contact_path_idx" ON "pages_blocks_contact" USING btree ("_path");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "pages_blocks_team_team_members" CASCADE;
  DROP TABLE "pages_blocks_team_about_content" CASCADE;
  DROP TABLE "pages_blocks_team" CASCADE;
  DROP TABLE "pages_blocks_timetable_time_slots" CASCADE;
  DROP TABLE "pages_blocks_timetable" CASCADE;
  DROP TABLE "pages_blocks_testimonials_videos" CASCADE;
  DROP TABLE "pages_blocks_testimonials" CASCADE;
  DROP TABLE "pages_blocks_pricing_pricing_options_features" CASCADE;
  DROP TABLE "pages_blocks_pricing_pricing_options" CASCADE;
  DROP TABLE "pages_blocks_pricing" CASCADE;
  DROP TABLE "pages_blocks_contact" CASCADE;`)
}
