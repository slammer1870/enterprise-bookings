import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE IF NOT EXISTS "pages_blocks_content" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"content" jsonb NOT NULL,
  	"block_name" varchar
  );
  
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
  
  DO $$ BEGIN
    ALTER TABLE "posts_blocks_form_block" DISABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN undefined_table THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "_posts_v_blocks_form_block" DISABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN undefined_table THEN null;
  END $$;
  DROP TABLE IF EXISTS "posts_blocks_form_block" CASCADE;
  DROP TABLE IF EXISTS "_posts_v_blocks_form_block" CASCADE;
  
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-07-25T20:02:22.923Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-07-25T20:02:23.082Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-07-25T20:02:23.082Z';
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pages_blocks_content_parent_id_fk') THEN
      ALTER TABLE "pages_blocks_content" ADD CONSTRAINT "pages_blocks_content_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_blocks_content_parent_id_fk') THEN
      ALTER TABLE "posts_blocks_content" ADD CONSTRAINT "posts_blocks_content_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_posts_v_blocks_content_parent_id_fk') THEN
      ALTER TABLE "_posts_v_blocks_content" ADD CONSTRAINT "_posts_v_blocks_content_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "pages_blocks_content_order_idx" ON "pages_blocks_content" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_content_parent_id_idx" ON "pages_blocks_content" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_content_path_idx" ON "pages_blocks_content" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "posts_blocks_content_order_idx" ON "posts_blocks_content" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "posts_blocks_content_parent_id_idx" ON "posts_blocks_content" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "posts_blocks_content_path_idx" ON "posts_blocks_content" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "_posts_v_blocks_content_order_idx" ON "_posts_v_blocks_content" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_posts_v_blocks_content_parent_id_idx" ON "_posts_v_blocks_content" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_posts_v_blocks_content_path_idx" ON "_posts_v_blocks_content" USING btree ("_path");
  
  ALTER TABLE "posts" DROP COLUMN IF EXISTS "content";
  ALTER TABLE "_posts_v" DROP COLUMN IF EXISTS "version_content";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
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
  
  DO $$ BEGIN
    ALTER TABLE "pages_blocks_content" DISABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN undefined_table THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "posts_blocks_content" DISABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN undefined_table THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "_posts_v_blocks_content" DISABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN undefined_table THEN null;
  END $$;
  DROP TABLE IF EXISTS "pages_blocks_content" CASCADE;
  DROP TABLE IF EXISTS "posts_blocks_content" CASCADE;
  DROP TABLE IF EXISTS "_posts_v_blocks_content" CASCADE;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-07-23T11:42:37.142Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-07-23T11:42:37.303Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-07-23T11:42:37.303Z';
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "content" jsonb;
  ALTER TABLE "_posts_v" ADD COLUMN IF NOT EXISTS "version_content" jsonb;
  
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_blocks_form_block_form_id_forms_id_fk') THEN
      ALTER TABLE "posts_blocks_form_block" ADD CONSTRAINT "posts_blocks_form_block_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_blocks_form_block_parent_id_fk') THEN
      ALTER TABLE "posts_blocks_form_block" ADD CONSTRAINT "posts_blocks_form_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_posts_v_blocks_form_block_form_id_forms_id_fk') THEN
      ALTER TABLE "_posts_v_blocks_form_block" ADD CONSTRAINT "_posts_v_blocks_form_block_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_posts_v_blocks_form_block_parent_id_fk') THEN
      ALTER TABLE "_posts_v_blocks_form_block" ADD CONSTRAINT "_posts_v_blocks_form_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
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
