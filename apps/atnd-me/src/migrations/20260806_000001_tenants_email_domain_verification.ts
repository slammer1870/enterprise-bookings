import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** Resend email domain verification fields on tenants. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_tenants_email_domain_status'
      ) THEN
        CREATE TYPE "public"."enum_tenants_email_domain_status" AS ENUM (
          'not_configured',
          'not_started',
          'pending',
          'verified',
          'failed'
        );
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tenants'
          AND column_name = 'resend_domain_id'
      ) THEN
        ALTER TABLE "tenants" ADD COLUMN "resend_domain_id" varchar;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tenants'
          AND column_name = 'email_domain_status'
      ) THEN
        ALTER TABLE "tenants"
          ADD COLUMN "email_domain_status" "public"."enum_tenants_email_domain_status"
          DEFAULT 'not_configured';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tenants'
          AND column_name = 'email_domain_verified_at'
      ) THEN
        ALTER TABLE "tenants"
          ADD COLUMN "email_domain_verified_at" timestamp(3) with time zone;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "tenants_resend_domain_id_idx"
      ON "tenants" USING btree ("resend_domain_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "tenants_resend_domain_id_idx";
  `)
  await db.execute(sql`
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "email_domain_verified_at";
  `)
  await db.execute(sql`
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "email_domain_status";
  `)
  await db.execute(sql`
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "resend_domain_id";
  `)
  await db.execute(sql`
    DROP TYPE IF EXISTS "public"."enum_tenants_email_domain_status";
  `)
}
