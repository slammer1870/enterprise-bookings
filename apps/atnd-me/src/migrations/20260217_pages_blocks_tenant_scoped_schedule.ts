import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add TenantScopedSchedule block table for Pages.
 * Schema was in Pages blocks but DB table was missing.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_tenant_scoped_schedule" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "default_tenant_id" integer,
      "block_name" varchar
    );
    CREATE INDEX IF NOT EXISTS "pages_blocks_tenant_scoped_schedule_order_idx"
    ON "pages_blocks_tenant_scoped_schedule" ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_tenant_scoped_schedule_parent_id_idx"
    ON "pages_blocks_tenant_scoped_schedule" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_tenant_scoped_schedule_path_idx"
    ON "pages_blocks_tenant_scoped_schedule" ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_tenant_scoped_schedule_default_tenant_idx"
    ON "pages_blocks_tenant_scoped_schedule" ("default_tenant_id");
  `)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_tenant_scoped_schedule"
      ADD CONSTRAINT "pages_blocks_tenant_scoped_schedule_default_tenant_id_tenants_id_fk"
      FOREIGN KEY ("default_tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_tenant_scoped_schedule"
      ADD CONSTRAINT "pages_blocks_tenant_scoped_schedule_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_tenant_scoped_schedule" DROP CONSTRAINT IF EXISTS "pages_blocks_tenant_scoped_schedule_parent_id_fk";
    ALTER TABLE "pages_blocks_tenant_scoped_schedule" DROP CONSTRAINT IF EXISTS "pages_blocks_tenant_scoped_schedule_default_tenant_id_tenants_id_fk";
    DROP TABLE IF EXISTS "pages_blocks_tenant_scoped_schedule";
  `)
}
