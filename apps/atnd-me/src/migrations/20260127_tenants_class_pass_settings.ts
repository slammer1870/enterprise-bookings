import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add classPassSettings group fields to tenants.
 * - Scalar/checkbox on tenants: class_pass_settings_enabled, class_pass_settings_default_expiration_days.
 * - Array "pricing" stored in separate table tenants_class_pass_settings_pricing.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "class_pass_settings_enabled" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "class_pass_settings_default_expiration_days" integer DEFAULT 365;
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "tenants_class_pass_settings_pricing" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "quantity" integer,
      "price" integer,
      "name" varchar
    );
  `)
  await db.execute(sql`
    ALTER TABLE "tenants_class_pass_settings_pricing"
      ADD CONSTRAINT "tenants_class_pass_settings_pricing_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "tenants_class_pass_settings_pricing_order_idx"
      ON "tenants_class_pass_settings_pricing" ("_order");
    CREATE INDEX IF NOT EXISTS "tenants_class_pass_settings_pricing_parent_id_idx"
      ON "tenants_class_pass_settings_pricing" ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "tenants_class_pass_settings_pricing"`)
  await db.execute(sql`
    ALTER TABLE "tenants"
      DROP COLUMN IF EXISTS "class_pass_settings_enabled",
      DROP COLUMN IF EXISTS "class_pass_settings_default_expiration_days";
  `)
}
