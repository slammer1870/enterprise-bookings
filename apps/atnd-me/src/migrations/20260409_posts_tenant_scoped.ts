import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Optional tenant on posts + tenant-scoped slugs (mirrors pages pattern).
 * Platform posts use tenant_id NULL with unique slug; tenant blogs use (tenant_id, slug).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "posts_slug_idx";

    DO $$ BEGIN
      ALTER TABLE "posts" ADD COLUMN "tenant_id" integer;
    EXCEPTION
      WHEN duplicate_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "posts" ADD CONSTRAINT "posts_tenant_id_tenants_id_fk"
        FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "posts_tenant_idx" ON "posts" USING btree ("tenant_id");

    CREATE UNIQUE INDEX IF NOT EXISTS "posts_slug_null_tenant_idx"
      ON "posts" USING btree ("slug") WHERE "tenant_id" IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS "posts_tenant_slug_idx"
      ON "posts" USING btree ("tenant_id", "slug") WHERE "tenant_id" IS NOT NULL;

    DO $$ BEGIN
      ALTER TABLE "_posts_v" ADD COLUMN "version_tenant_id" integer;
    EXCEPTION
      WHEN duplicate_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_tenant_id_tenants_id_fk"
        FOREIGN KEY ("version_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "_posts_v_version_version_tenant_idx"
      ON "_posts_v" USING btree ("version_tenant_id");

    CREATE UNIQUE INDEX IF NOT EXISTS "_posts_v_tenant_version_slug_idx"
      ON "_posts_v" USING btree ("version_tenant_id", "version_slug")
      WHERE "version_tenant_id" IS NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "_posts_v_tenant_version_slug_idx";
    DROP INDEX IF EXISTS "_posts_v_version_version_tenant_idx";
    ALTER TABLE "_posts_v" DROP CONSTRAINT IF EXISTS "_posts_v_version_tenant_id_tenants_id_fk";
    ALTER TABLE "_posts_v" DROP COLUMN IF EXISTS "version_tenant_id";

    DROP INDEX IF EXISTS "posts_tenant_slug_idx";
    DROP INDEX IF EXISTS "posts_slug_null_tenant_idx";
    DROP INDEX IF EXISTS "posts_tenant_idx";
    ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_tenant_id_tenants_id_fk";
    ALTER TABLE "posts" DROP COLUMN IF EXISTS "tenant_id";

    CREATE UNIQUE INDEX IF NOT EXISTS "posts_slug_idx" ON "posts" USING btree ("slug");
  `)
}
