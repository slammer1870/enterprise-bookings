import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add tenants_allowed_blocks table for Tenants.allowedBlocks (select hasMany).
 * Phase 3: Custom tenant-scoped blocks.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "tenants_allowed_blocks" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" varchar,
      "id" serial PRIMARY KEY NOT NULL
    );
  `)
  await db.execute(sql`
    ALTER TABLE "tenants_allowed_blocks"
      ADD CONSTRAINT "tenants_allowed_blocks_parent_fk"
      FOREIGN KEY ("parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "tenants_allowed_blocks_order_idx"
      ON "tenants_allowed_blocks" ("order");
    CREATE INDEX IF NOT EXISTS "tenants_allowed_blocks_parent_idx"
      ON "tenants_allowed_blocks" ("parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "tenants_allowed_blocks"`)
}
