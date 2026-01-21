import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "navbar_tenant_idx";
  DROP INDEX "scheduler_tenant_idx";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-01-21T17:35:02.953Z';
  CREATE UNIQUE INDEX "navbar_tenant_idx" ON "navbar" USING btree ("tenant_id");
  CREATE UNIQUE INDEX "scheduler_tenant_idx" ON "scheduler" USING btree ("tenant_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "navbar_tenant_idx";
  DROP INDEX "scheduler_tenant_idx";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-01-21T12:17:12.932Z';
  CREATE INDEX "navbar_tenant_idx" ON "navbar" USING btree ("tenant_id");
  CREATE INDEX "scheduler_tenant_idx" ON "scheduler" USING btree ("tenant_id");`)
}
