import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Step 2.7.1 – Platform fees global: defaults, per-tenant overrides, optional bounds.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE "platform_fees" (
      "id" serial PRIMARY KEY NOT NULL,
      "defaults_drop_in_percent" numeric DEFAULT 2 NOT NULL,
      "defaults_class_pass_percent" numeric DEFAULT 3 NOT NULL,
      "defaults_subscription_percent" numeric DEFAULT 4 NOT NULL,
      "bounds_min_cents" numeric,
      "bounds_max_cents" numeric,
      "updated_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone
    );

    CREATE TABLE "platform_fees_overrides" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "tenant_id" integer,
      "drop_in_percent" numeric,
      "class_pass_percent" numeric,
      "subscription_percent" numeric
    );

    ALTER TABLE "platform_fees_overrides"
      ADD CONSTRAINT "platform_fees_overrides_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."platform_fees"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "platform_fees_overrides"
      ADD CONSTRAINT "platform_fees_overrides_tenant_id_tenants_id_fk"
      FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;

    CREATE INDEX "platform_fees_overrides_order_idx" ON "platform_fees_overrides" USING btree ("_order");
    CREATE INDEX "platform_fees_overrides_parent_id_idx" ON "platform_fees_overrides" USING btree ("_parent_id");
    CREATE INDEX "platform_fees_overrides_tenant_idx" ON "platform_fees_overrides" USING btree ("tenant_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "platform_fees_overrides" CASCADE;
    DROP TABLE IF EXISTS "platform_fees" CASCADE;
  `)
}
