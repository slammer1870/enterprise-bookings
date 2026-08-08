import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * TenantScopedSchedule block `tenants` hasMany is stored on pages_rels / _pages_v_rels.
 * Adds tenants_id so Payload can load/save curated schedule dropdown tenants.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_rels"
      ADD COLUMN IF NOT EXISTS "tenants_id" integer;

    DO $$ BEGIN
      ALTER TABLE "pages_rels"
        ADD CONSTRAINT "pages_rels_tenants_fk"
          FOREIGN KEY ("tenants_id") REFERENCES "public"."tenants"("id")
          ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "pages_rels_tenants_id_idx"
      ON "pages_rels" USING btree ("tenants_id");

    ALTER TABLE "_pages_v_rels"
      ADD COLUMN IF NOT EXISTS "tenants_id" integer;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_rels"
        ADD CONSTRAINT "_pages_v_rels_tenants_fk"
          FOREIGN KEY ("tenants_id") REFERENCES "public"."tenants"("id")
          ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "_pages_v_rels_tenants_id_idx"
      ON "_pages_v_rels" USING btree ("tenants_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "_pages_v_rels_tenants_id_idx";
    ALTER TABLE "_pages_v_rels"
      DROP CONSTRAINT IF EXISTS "_pages_v_rels_tenants_fk";
    ALTER TABLE "_pages_v_rels"
      DROP COLUMN IF EXISTS "tenants_id";

    DROP INDEX IF EXISTS "pages_rels_tenants_id_idx";
    ALTER TABLE "pages_rels"
      DROP CONSTRAINT IF EXISTS "pages_rels_tenants_fk";
    ALTER TABLE "pages_rels"
      DROP COLUMN IF EXISTS "tenants_id";
  `)
}
