import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "bookings" DROP CONSTRAINT "bookings_transaction_id_transactions_id_fk";
  
  DROP INDEX IF EXISTS "bookings_transaction_idx";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-05-15T21:31:34.538Z';
  ALTER TABLE "scheduler_schedule_monday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-05-15T21:31:34.539Z';
  ALTER TABLE "scheduler_schedule_monday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-05-15T21:31:34.539Z';
  ALTER TABLE "scheduler_schedule_tuesday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-05-15T21:31:34.539Z';
  ALTER TABLE "scheduler_schedule_tuesday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-05-15T21:31:34.539Z';
  ALTER TABLE "scheduler_schedule_wednesday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-05-15T21:31:34.539Z';
  ALTER TABLE "scheduler_schedule_wednesday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-05-15T21:31:34.539Z';
  ALTER TABLE "scheduler_schedule_thursday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-05-15T21:31:34.539Z';
  ALTER TABLE "scheduler_schedule_thursday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-05-15T21:31:34.539Z';
  ALTER TABLE "scheduler_schedule_friday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-05-15T21:31:34.539Z';
  ALTER TABLE "scheduler_schedule_friday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-05-15T21:31:34.539Z';
  ALTER TABLE "scheduler_schedule_saturday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-05-15T21:31:34.539Z';
  ALTER TABLE "scheduler_schedule_saturday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-05-15T21:31:34.539Z';
  ALTER TABLE "scheduler_schedule_sunday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-05-15T21:31:34.539Z';
  ALTER TABLE "scheduler_schedule_sunday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-05-15T21:31:34.539Z';
  ALTER TABLE "scheduler" ALTER COLUMN "start_date" SET DEFAULT '2025-05-15T21:31:34.539Z';
  ALTER TABLE "scheduler" ALTER COLUMN "end_date" SET DEFAULT '2025-05-15T21:31:34.539Z';
  ALTER TABLE "pages_blocks_contact" ADD COLUMN "form_id" integer NOT NULL;
  ALTER TABLE "pages_blocks_groups" ADD COLUMN "cta_form_id" integer NOT NULL;
  ALTER TABLE "pages" ADD COLUMN "meta_title" varchar;
  ALTER TABLE "pages" ADD COLUMN "meta_description" varchar;
  ALTER TABLE "pages" ADD COLUMN "meta_image_id" integer;
  ALTER TABLE "lessons" ADD COLUMN "original_lock_out_time" numeric;
  DO $$ BEGIN
   ALTER TABLE "pages_blocks_contact" ADD CONSTRAINT "pages_blocks_contact_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "pages_blocks_groups" ADD CONSTRAINT "pages_blocks_groups_cta_form_id_forms_id_fk" FOREIGN KEY ("cta_form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "pages" ADD CONSTRAINT "pages_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "pages_blocks_contact_form_idx" ON "pages_blocks_contact" USING btree ("form_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_groups_cta_cta_form_idx" ON "pages_blocks_groups" USING btree ("cta_form_id");
  CREATE INDEX IF NOT EXISTS "pages_meta_meta_image_idx" ON "pages" USING btree ("meta_image_id");
  ALTER TABLE "pages_blocks_contact" DROP COLUMN IF EXISTS "contact_title";
  ALTER TABLE "pages_blocks_contact" DROP COLUMN IF EXISTS "contact_description";
  ALTER TABLE "bookings" DROP COLUMN IF EXISTS "transaction_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_contact" DROP CONSTRAINT "pages_blocks_contact_form_id_forms_id_fk";
  
  ALTER TABLE "pages_blocks_groups" DROP CONSTRAINT "pages_blocks_groups_cta_form_id_forms_id_fk";
  
  ALTER TABLE "pages" DROP CONSTRAINT "pages_meta_image_id_media_id_fk";
  
  DROP INDEX IF EXISTS "pages_blocks_contact_form_idx";
  DROP INDEX IF EXISTS "pages_blocks_groups_cta_cta_form_idx";
  DROP INDEX IF EXISTS "pages_meta_meta_image_idx";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-05-13T14:42:41.873Z';
  ALTER TABLE "scheduler_schedule_monday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-05-13T14:42:41.873Z';
  ALTER TABLE "scheduler_schedule_monday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-05-13T14:42:41.873Z';
  ALTER TABLE "scheduler_schedule_tuesday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-05-13T14:42:41.873Z';
  ALTER TABLE "scheduler_schedule_tuesday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-05-13T14:42:41.873Z';
  ALTER TABLE "scheduler_schedule_wednesday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-05-13T14:42:41.873Z';
  ALTER TABLE "scheduler_schedule_wednesday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-05-13T14:42:41.873Z';
  ALTER TABLE "scheduler_schedule_thursday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-05-13T14:42:41.873Z';
  ALTER TABLE "scheduler_schedule_thursday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-05-13T14:42:41.873Z';
  ALTER TABLE "scheduler_schedule_friday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-05-13T14:42:41.873Z';
  ALTER TABLE "scheduler_schedule_friday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-05-13T14:42:41.873Z';
  ALTER TABLE "scheduler_schedule_saturday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-05-13T14:42:41.873Z';
  ALTER TABLE "scheduler_schedule_saturday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-05-13T14:42:41.873Z';
  ALTER TABLE "scheduler_schedule_sunday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-05-13T14:42:41.873Z';
  ALTER TABLE "scheduler_schedule_sunday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-05-13T14:42:41.873Z';
  ALTER TABLE "scheduler" ALTER COLUMN "start_date" SET DEFAULT '2025-05-13T14:42:41.873Z';
  ALTER TABLE "scheduler" ALTER COLUMN "end_date" SET DEFAULT '2025-05-13T14:42:41.873Z';
  ALTER TABLE "pages_blocks_contact" ADD COLUMN "contact_title" varchar DEFAULT 'Contact Us' NOT NULL;
  ALTER TABLE "pages_blocks_contact" ADD COLUMN "contact_description" varchar DEFAULT 'Do you have any questions? Fill in our contact form and we will get back to you as soon as possible!' NOT NULL;
  ALTER TABLE "bookings" ADD COLUMN "transaction_id" integer;
  DO $$ BEGIN
   ALTER TABLE "bookings" ADD CONSTRAINT "bookings_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "bookings_transaction_idx" ON "bookings" USING btree ("transaction_id");
  ALTER TABLE "pages_blocks_contact" DROP COLUMN IF EXISTS "form_id";
  ALTER TABLE "pages_blocks_groups" DROP COLUMN IF EXISTS "cta_form_id";
  ALTER TABLE "pages" DROP COLUMN IF EXISTS "meta_title";
  ALTER TABLE "pages" DROP COLUMN IF EXISTS "meta_description";
  ALTER TABLE "pages" DROP COLUMN IF EXISTS "meta_image_id";
  ALTER TABLE "lessons" DROP COLUMN IF EXISTS "original_lock_out_time";`)
}
