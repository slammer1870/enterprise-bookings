import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Kyuzo uses bookings-payments membership plugin (collection slug: "memberships").
 *
 * In CI/test we run with `push: false`, so the DB schema must be created via migrations.
 * Older Kyuzo migrations used a "plans" table; this migration creates or upgrades to
 * the "memberships" tables + enums and points existing FKs (subscriptions, rels tables) at it.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Enums used by memberships fields
    DO $$ BEGIN
      CREATE TYPE "public"."enum_memberships_sessions_information_interval"
        AS ENUM('day', 'week', 'month', 'quarter', 'year');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_memberships_price_information_interval"
        AS ENUM('day', 'week', 'month', 'year');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_memberships_status"
        AS ENUM('active', 'inactive');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_memberships_type"
        AS ENUM('adult', 'child');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- Tables
    CREATE TABLE IF NOT EXISTS "memberships_features" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "feature" varchar
    );

    CREATE TABLE IF NOT EXISTS "memberships" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "features" jsonb,
      "sessions_information_sessions" numeric,
      "sessions_information_interval_count" numeric,
      "sessions_information_interval" "enum_memberships_sessions_information_interval",
      "sessions_information_allow_multiple_bookings_per_lesson" boolean DEFAULT true,
      "stripe_product_id" varchar,
      "price_information_price" numeric,
      "price_information_interval_count" numeric,
      "price_information_interval" "enum_memberships_price_information_interval" DEFAULT 'month',
      "price_j_s_o_n" varchar,
      "status" "enum_memberships_status" DEFAULT 'active' NOT NULL,
      "skip_sync" boolean DEFAULT false,
      "type" "enum_memberships_type" DEFAULT 'adult',
      "quantity" numeric,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- memberships_features FK + indexes
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'memberships_features_parent_id_fk') THEN
        ALTER TABLE "memberships_features"
          ADD CONSTRAINT "memberships_features_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "public"."memberships"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS "memberships_features_order_idx" ON "memberships_features" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "memberships_features_parent_id_idx" ON "memberships_features" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "memberships_updated_at_idx" ON "memberships" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "memberships_created_at_idx" ON "memberships" USING btree ("created_at");

    -- Legacy safety: some deployed DBs may not yet have plans.features.
    DO $$ BEGIN
      IF to_regclass('public.plans') IS NOT NULL THEN
        ALTER TABLE "public"."plans" ADD COLUMN IF NOT EXISTS "features" jsonb;
      END IF;
    END $$;

    -- Migrate legacy "plans" data into "memberships" when present.
    DO $$ BEGIN
      IF to_regclass('public.plans') IS NOT NULL THEN
        INSERT INTO "memberships" (
          "id",
          "name",
          "features",
          "sessions_information_sessions",
          "sessions_information_interval_count",
          "sessions_information_interval",
          "sessions_information_allow_multiple_bookings_per_lesson",
          "stripe_product_id",
          "price_information_price",
          "price_information_interval_count",
          "price_information_interval",
          "price_j_s_o_n",
          "status",
          "skip_sync",
          "type",
          "quantity",
          "updated_at",
          "created_at"
        )
        SELECT
          "id",
          "name",
          "features",
          "sessions_information_sessions",
          "sessions_information_interval_count",
          "sessions_information_interval",
          "sessions_information_allow_multiple_bookings_per_lesson",
          "stripe_product_id",
          "price_information_price",
          "price_information_interval_count",
          "price_information_interval",
          "price_j_s_o_n",
          "status",
          "skip_sync",
          "type",
          "quantity",
          "updated_at",
          "created_at"
        FROM "public"."plans"
        ON CONFLICT ("id")
        DO UPDATE SET
          "name" = EXCLUDED."name",
          "features" = EXCLUDED."features",
          "sessions_information_sessions" = EXCLUDED."sessions_information_sessions",
          "sessions_information_interval_count" = EXCLUDED."sessions_information_interval_count",
          "sessions_information_interval" = EXCLUDED."sessions_information_interval",
          "sessions_information_allow_multiple_bookings_per_lesson" = EXCLUDED."sessions_information_allow_multiple_bookings_per_lesson",
          "stripe_product_id" = EXCLUDED."stripe_product_id",
          "price_information_price" = EXCLUDED."price_information_price",
          "price_information_interval_count" = EXCLUDED."price_information_interval_count",
          "price_information_interval" = EXCLUDED."price_information_interval",
          "price_j_s_o_n" = EXCLUDED."price_j_s_o_n",
          "status" = EXCLUDED."status",
          "skip_sync" = EXCLUDED."skip_sync",
          "type" = EXCLUDED."type",
          "quantity" = EXCLUDED."quantity",
          "updated_at" = EXCLUDED."updated_at",
          "created_at" = EXCLUDED."created_at";
      END IF;
    END $$;

    -- Copy legacy plan feature rows as membership features, preserving IDs.
    DO $$ BEGIN
      IF to_regclass('public.plans_features') IS NOT NULL THEN
        INSERT INTO "memberships_features" ("_order", "_parent_id", "id", "feature")
        SELECT "_order", "_parent_id", "id", "feature"
        FROM "public"."plans_features"
        ON CONFLICT ("id")
        DO UPDATE SET
          "_order" = EXCLUDED."_order",
          "_parent_id" = EXCLUDED."_parent_id",
          "feature" = EXCLUDED."feature";
      END IF;
    END $$;

    -- If subscriptions contain old plan IDs that have not been migrated, null them first.
    -- This avoids FK failures when switching the FK target from plans -> memberships.
    DO $$ BEGIN
      IF to_regclass('public.subscriptions') IS NOT NULL THEN
        UPDATE "subscriptions" s
        SET "plan_id" = NULL
        WHERE "plan_id" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "public"."memberships" m WHERE m."id" = s."plan_id"
          );
      END IF;
    END $$;

    -- Point subscriptions.plan_id at memberships (drop legacy FK to plans if present)
    DO $$ BEGIN
      IF to_regclass('public.subscriptions') IS NOT NULL THEN
        ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_plan_id_plans_id_fk";
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_plan_id_memberships_id_fk') THEN
        ALTER TABLE "subscriptions"
          ADD CONSTRAINT "subscriptions_plan_id_memberships_id_fk"
          FOREIGN KEY ("plan_id") REFERENCES "public"."memberships"("id")
          ON DELETE set null ON UPDATE no action;
        END IF;
      END IF;
    END $$;

    -- Ensure rel-table FKs exist now that memberships exists
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'class_options_rels' AND column_name = 'memberships_id'
      ) THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_options_rels_memberships_fk') THEN
          ALTER TABLE "class_options_rels"
            ADD CONSTRAINT "class_options_rels_memberships_fk"
            FOREIGN KEY ("memberships_id") REFERENCES "public"."memberships"("id")
            ON DELETE cascade ON UPDATE no action;
        END IF;
      END IF;
    END $$;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'memberships_id'
      ) THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_memberships_fk') THEN
          ALTER TABLE "payload_locked_documents_rels"
            ADD CONSTRAINT "payload_locked_documents_rels_memberships_fk"
            FOREIGN KEY ("memberships_id") REFERENCES "public"."memberships"("id")
            ON DELETE cascade ON UPDATE no action;
        END IF;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_memberships_fk";
    ALTER TABLE "class_options_rels" DROP CONSTRAINT IF EXISTS "class_options_rels_memberships_fk";
    ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_plan_id_memberships_id_fk";
    DO $$ BEGIN
      IF to_regclass('public.plans') IS NOT NULL THEN
        ALTER TABLE "subscriptions"
          ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk"
          FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DROP TABLE IF EXISTS "memberships_features" CASCADE;
    DROP TABLE IF EXISTS "memberships" CASCADE;

    DROP TYPE IF EXISTS "public"."enum_memberships_type";
    DROP TYPE IF EXISTS "public"."enum_memberships_status";
    DROP TYPE IF EXISTS "public"."enum_memberships_price_information_interval";
    DROP TYPE IF EXISTS "public"."enum_memberships_sessions_information_interval";
  `)
}

