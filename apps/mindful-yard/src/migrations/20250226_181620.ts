import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_drop_ins_price_type" AS ENUM('trial', 'normal');
  CREATE TABLE IF NOT EXISTS "class_options_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"drop_ins_id" integer
  );
  
  CREATE TABLE IF NOT EXISTS "drop_ins_discount_tiers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"min_quantity" numeric,
  	"discount_percent" numeric
  );
  
  CREATE TABLE IF NOT EXISTS "drop_ins" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"active" boolean DEFAULT true NOT NULL,
  	"price" numeric NOT NULL,
  	"price_type" "enum_drop_ins_price_type" DEFAULT 'normal' NOT NULL,
  	"adjustable" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "drop_ins_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"class_options_id" integer
  );
  
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-02-26T18:16:20.247Z';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "drop_ins_id" integer;
  DO $$ BEGIN
   ALTER TABLE "class_options_rels" ADD CONSTRAINT "class_options_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."class_options"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "class_options_rels" ADD CONSTRAINT "class_options_rels_drop_ins_fk" FOREIGN KEY ("drop_ins_id") REFERENCES "public"."drop_ins"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "drop_ins_discount_tiers" ADD CONSTRAINT "drop_ins_discount_tiers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."drop_ins"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "drop_ins_rels" ADD CONSTRAINT "drop_ins_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."drop_ins"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "drop_ins_rels" ADD CONSTRAINT "drop_ins_rels_class_options_fk" FOREIGN KEY ("class_options_id") REFERENCES "public"."class_options"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "class_options_rels_order_idx" ON "class_options_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "class_options_rels_parent_idx" ON "class_options_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "class_options_rels_path_idx" ON "class_options_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "class_options_rels_drop_ins_id_idx" ON "class_options_rels" USING btree ("drop_ins_id");
  CREATE INDEX IF NOT EXISTS "drop_ins_discount_tiers_order_idx" ON "drop_ins_discount_tiers" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "drop_ins_discount_tiers_parent_id_idx" ON "drop_ins_discount_tiers" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "drop_ins_updated_at_idx" ON "drop_ins" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "drop_ins_created_at_idx" ON "drop_ins" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "drop_ins_rels_order_idx" ON "drop_ins_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "drop_ins_rels_parent_idx" ON "drop_ins_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "drop_ins_rels_path_idx" ON "drop_ins_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "drop_ins_rels_class_options_id_idx" ON "drop_ins_rels" USING btree ("class_options_id");
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_drop_ins_fk" FOREIGN KEY ("drop_ins_id") REFERENCES "public"."drop_ins"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_drop_ins_id_idx" ON "payload_locked_documents_rels" USING btree ("drop_ins_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "class_options_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "drop_ins_discount_tiers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "drop_ins" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "drop_ins_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "class_options_rels" CASCADE;
  DROP TABLE "drop_ins_discount_tiers" CASCADE;
  DROP TABLE "drop_ins" CASCADE;
  DROP TABLE "drop_ins_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_drop_ins_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_drop_ins_id_idx";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-02-26T10:38:46.778Z';
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "drop_ins_id";
  DROP TYPE "public"."enum_drop_ins_price_type";`)
}
