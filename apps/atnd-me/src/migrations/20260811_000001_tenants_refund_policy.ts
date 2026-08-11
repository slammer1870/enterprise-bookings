import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Tenant refund policy group + booking_transactions idempotency fields for cancel refunds.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_tenants_refund_policy_advanced_drop_in_mode'
      ) THEN
        CREATE TYPE "public"."enum_tenants_refund_policy_advanced_drop_in_mode" AS ENUM (
          'inherit',
          'custom',
          'never'
        );
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_tenants_refund_policy_advanced_class_pass_mode'
      ) THEN
        CREATE TYPE "public"."enum_tenants_refund_policy_advanced_class_pass_mode" AS ENUM (
          'inherit',
          'custom',
          'never'
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
          AND column_name = 'refund_policy_default_window_hours'
      ) THEN
        ALTER TABLE "tenants"
          ADD COLUMN "refund_policy_default_window_hours" numeric;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tenants'
          AND column_name = 'refund_policy_advanced_drop_in_mode'
      ) THEN
        ALTER TABLE "tenants"
          ADD COLUMN "refund_policy_advanced_drop_in_mode"
            "public"."enum_tenants_refund_policy_advanced_drop_in_mode"
            DEFAULT 'inherit';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tenants'
          AND column_name = 'refund_policy_advanced_drop_in_window_hours'
      ) THEN
        ALTER TABLE "tenants"
          ADD COLUMN "refund_policy_advanced_drop_in_window_hours" numeric;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tenants'
          AND column_name = 'refund_policy_advanced_class_pass_mode'
      ) THEN
        ALTER TABLE "tenants"
          ADD COLUMN "refund_policy_advanced_class_pass_mode"
            "public"."enum_tenants_refund_policy_advanced_class_pass_mode"
            DEFAULT 'inherit';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tenants'
          AND column_name = 'refund_policy_advanced_class_pass_window_hours'
      ) THEN
        ALTER TABLE "tenants"
          ADD COLUMN "refund_policy_advanced_class_pass_window_hours" numeric;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'booking_transactions'
          AND column_name = 'refunded_at'
      ) THEN
        ALTER TABLE "booking_transactions"
          ADD COLUMN "refunded_at" timestamp(3) with time zone;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'booking_transactions'
          AND column_name = 'stripe_refund_id'
      ) THEN
        ALTER TABLE "booking_transactions"
          ADD COLUMN "stripe_refund_id" varchar;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'booking_transactions'
          AND column_name = 'class_pass_restored_at'
      ) THEN
        ALTER TABLE "booking_transactions"
          ADD COLUMN "class_pass_restored_at" timestamp(3) with time zone;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "booking_transactions" DROP COLUMN IF EXISTS "class_pass_restored_at";
  `)
  await db.execute(sql`
    ALTER TABLE "booking_transactions" DROP COLUMN IF EXISTS "stripe_refund_id";
  `)
  await db.execute(sql`
    ALTER TABLE "booking_transactions" DROP COLUMN IF EXISTS "refunded_at";
  `)
  await db.execute(sql`
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "refund_policy_advanced_class_pass_window_hours";
  `)
  await db.execute(sql`
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "refund_policy_advanced_class_pass_mode";
  `)
  await db.execute(sql`
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "refund_policy_advanced_drop_in_window_hours";
  `)
  await db.execute(sql`
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "refund_policy_advanced_drop_in_mode";
  `)
  await db.execute(sql`
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "refund_policy_default_window_hours";
  `)
  await db.execute(sql`
    DROP TYPE IF EXISTS "public"."enum_tenants_refund_policy_advanced_class_pass_mode";
  `)
  await db.execute(sql`
    DROP TYPE IF EXISTS "public"."enum_tenants_refund_policy_advanced_drop_in_mode";
  `)
}
