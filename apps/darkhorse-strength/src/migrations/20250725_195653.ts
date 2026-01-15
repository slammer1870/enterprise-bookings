import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE IF NOT EXISTS "posts_blocks_content" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"content" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "_posts_v_blocks_content" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"content" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  ALTER TABLE "posts_blocks_form_block" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_blocks_form_block" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "posts_blocks_form_block" CASCADE;
  DROP TABLE IF EXISTS "_posts_v_blocks_form_block" CASCADE;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-07-25T19:56:53.615Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-07-25T19:56:53.615Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-07-25T19:56:53.615Z';
  DO $$ BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_blocks_content_parent_id_fk') THEN
    ALTER TABLE "posts_blocks_content" ADD CONSTRAINT "posts_blocks_content_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
   END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  DO $$ BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_posts_v_blocks_content_parent_id_fk') THEN
    ALTER TABLE "_posts_v_blocks_content" ADD CONSTRAINT "_posts_v_blocks_content_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
   END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  CREATE INDEX IF NOT EXISTS "posts_blocks_content_order_idx" ON "posts_blocks_content" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "posts_blocks_content_parent_id_idx" ON "posts_blocks_content" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "posts_blocks_content_path_idx" ON "posts_blocks_content" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "_posts_v_blocks_content_order_idx" ON "_posts_v_blocks_content" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_posts_v_blocks_content_parent_id_idx" ON "_posts_v_blocks_content" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_posts_v_blocks_content_path_idx" ON "_posts_v_blocks_content" USING btree ("_path");
  DO $$ BEGIN
   IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'content') THEN
    ALTER TABLE "posts" DROP COLUMN "content";
   END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  DO $$ BEGIN
   IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '_posts_v' AND column_name = 'version_content') THEN
    ALTER TABLE "_posts_v" DROP COLUMN "version_content";
   END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE IF NOT EXISTS "posts_blocks_form_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"form_id" integer,
  	"enable_intro" boolean,
  	"intro_content" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "_posts_v_blocks_form_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"form_id" integer,
  	"enable_intro" boolean,
  	"intro_content" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  ALTER TABLE "posts_blocks_content" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_blocks_content" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "posts_blocks_content" CASCADE;
  DROP TABLE IF EXISTS "_posts_v_blocks_content" CASCADE;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-07-23T11:01:30.610Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-07-23T11:01:30.610Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-07-23T11:01:30.610Z';
  DO $$ BEGIN
   IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'content') THEN
    ALTER TABLE "posts" ADD COLUMN "content" jsonb;
   END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  DO $$ BEGIN
   IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '_posts_v' AND column_name = 'version_content') THEN
    ALTER TABLE "_posts_v" ADD COLUMN "version_content" jsonb;
   END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  DO $$ BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_blocks_form_block_form_id_forms_id_fk') THEN
    ALTER TABLE "posts_blocks_form_block" ADD CONSTRAINT "posts_blocks_form_block_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
   END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  DO $$ BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_blocks_form_block_parent_id_fk') THEN
    ALTER TABLE "posts_blocks_form_block" ADD CONSTRAINT "posts_blocks_form_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
   END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  DO $$ BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_posts_v_blocks_form_block_form_id_forms_id_fk') THEN
    ALTER TABLE "_posts_v_blocks_form_block" ADD CONSTRAINT "_posts_v_blocks_form_block_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
   END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  DO $$ BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_posts_v_blocks_form_block_parent_id_fk') THEN
    ALTER TABLE "_posts_v_blocks_form_block" ADD CONSTRAINT "_posts_v_blocks_form_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
   END IF;
  EXCEPTION WHEN OTHERS THEN null;
  END $$;
  CREATE INDEX IF NOT EXISTS "posts_blocks_form_block_order_idx" ON "posts_blocks_form_block" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "posts_blocks_form_block_parent_id_idx" ON "posts_blocks_form_block" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "posts_blocks_form_block_path_idx" ON "posts_blocks_form_block" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "posts_blocks_form_block_form_idx" ON "posts_blocks_form_block" USING btree ("form_id");
  CREATE INDEX IF NOT EXISTS "_posts_v_blocks_form_block_order_idx" ON "_posts_v_blocks_form_block" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_posts_v_blocks_form_block_parent_id_idx" ON "_posts_v_blocks_form_block" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_posts_v_blocks_form_block_path_idx" ON "_posts_v_blocks_form_block" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "_posts_v_blocks_form_block_form_idx" ON "_posts_v_blocks_form_block" USING btree ("form_id");`)
}
