import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Replace global unique index on class_options.name with tenant-scoped uniqueness.
 * Drops class_options_name_idx and creates class_options_tenant_id_name_idx
 * so the same class name can exist in different tenants (e.g. "Wood fired sauna" per location).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "class_options_name_idx";
  `)
  await db.execute(sql`
    CREATE UNIQUE INDEX "class_options_tenant_id_name_idx"
    ON "class_options" USING btree ("tenant_id", "name")
    WHERE "tenant_id" IS NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "class_options_tenant_id_name_idx";
  `)
  await db.execute(sql`
    CREATE UNIQUE INDEX "class_options_name_idx"
    ON "class_options" USING btree ("name");
  `)
}
