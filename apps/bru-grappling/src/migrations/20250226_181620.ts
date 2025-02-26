import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE IF NOT EXISTS "drop_ins_discount_tiers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"min_quantity" numeric,
  	"discount_percent" numeric
  );
  
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-02-26T18:16:20.266Z';
  ALTER TABLE "drop_ins" ALTER COLUMN "active" SET NOT NULL;
  ALTER TABLE "drop_ins" ADD COLUMN "adjustable" boolean DEFAULT false;
  DO $$ BEGIN
   ALTER TABLE "drop_ins_discount_tiers" ADD CONSTRAINT "drop_ins_discount_tiers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."drop_ins"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "drop_ins_discount_tiers_order_idx" ON "drop_ins_discount_tiers" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "drop_ins_discount_tiers_parent_id_idx" ON "drop_ins_discount_tiers" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "drop_ins_discount_tiers" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "drop_ins_discount_tiers" CASCADE;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-02-26T10:38:46.800Z';
  ALTER TABLE "drop_ins" ALTER COLUMN "active" DROP NOT NULL;
  ALTER TABLE "drop_ins" DROP COLUMN IF EXISTS "adjustable";`)
}
