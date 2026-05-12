import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * `skip_sync` on discount-codes: super-admin import path; bypasses Stripe Connect beforeValidate.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'discount_codes'
      ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'discount_codes'
          AND column_name = 'skip_sync'
      ) THEN
        ALTER TABLE "discount_codes" ADD COLUMN "skip_sync" boolean DEFAULT false NOT NULL;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'discount_codes'
          AND column_name = 'skip_sync'
      ) THEN
        ALTER TABLE "discount_codes" DROP COLUMN "skip_sync";
      END IF;
    END $$;
  `)
}
