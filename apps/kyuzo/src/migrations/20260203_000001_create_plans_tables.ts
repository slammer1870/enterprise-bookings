import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Kyuzo uses bookings-payments membership plugin (collection slug: "plans").
 *
 * In CI/test we run with `push: false`, so the DB schema must be created via migrations.
 * This migration creates the "plans" tables + enums and points existing FKs
 * (subscriptions, rels tables) at it.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Enums used by plans fields
    DO $$ BEGIN
      CREATE TYPE "public"."enum_plans_sessions_information_interval"
        AS ENUM('day', 'week', 'month', 'quarter', 'year');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_plans_price_information_interval"
        AS ENUM('day', 'week', 'month', 'year');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_plans_status"
        AS ENUM('active', 'inactive');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_plans_type"
        AS ENUM('adult', 'child');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- Tables
    CREATE TABLE IF NOT EXISTS "plans_features" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "feature" varchar
    );

    CREATE TABLE IF NOT EXISTS "plans" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "features" jsonb,
      "sessions_information_sessions" numeric,
      "sessions_information_interval_count" numeric,
      "sessions_information_interval" "enum_plans_sessions_information_interval",
      "sessions_information_allow_multiple_bookings_per_lesson" boolean DEFAULT true,
      "stripe_product_id" varchar,
      "price_information_price" numeric,
      "price_information_interval_count" numeric,
      "price_information_interval" "enum_plans_price_information_interval" DEFAULT 'month',
      "price_j_s_o_n" varchar,
      "status" "enum_plans_status" DEFAULT 'active' NOT NULL,
      "skip_sync" boolean DEFAULT false,
      "type" "enum_plans_type" DEFAULT 'adult',
      "quantity" numeric,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- plans_features FK + indexes
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_features_parent_id_fk') THEN
        ALTER TABLE "plans_features"
          ADD CONSTRAINT "plans_features_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "public"."plans"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS "plans_features_order_idx" ON "plans_features" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "plans_features_parent_id_idx" ON "plans_features" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "plans_updated_at_idx" ON "plans" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "plans_created_at_idx" ON "plans" USING btree ("created_at");

    -- Point subscriptions.plan_id at plans
    ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_plan_id_memberships_id_fk";
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_plan_id_plans_id_fk') THEN
        ALTER TABLE "subscriptions"
          ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk"
          FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;

    -- Ensure rel-table FKs exist now that plans exists (plans_id columns)
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'class_options_rels' AND column_name = 'plans_id'
      ) THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_options_rels_plans_fk') THEN
          ALTER TABLE "class_options_rels"
            ADD CONSTRAINT "class_options_rels_plans_fk"
            FOREIGN KEY ("plans_id") REFERENCES "public"."plans"("id")
            ON DELETE cascade ON UPDATE no action;
        END IF;
      END IF;
    END $$;

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'plans_id'
      ) THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_plans_fk') THEN
          ALTER TABLE "payload_locked_documents_rels"
            ADD CONSTRAINT "payload_locked_documents_rels_plans_fk"
            FOREIGN KEY ("plans_id") REFERENCES "public"."plans"("id")
            ON DELETE cascade ON UPDATE no action;
        END IF;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_plans_fk";
    ALTER TABLE "class_options_rels" DROP CONSTRAINT IF EXISTS "class_options_rels_plans_fk";
    ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_plan_id_plans_id_fk";

    DROP TABLE IF EXISTS "plans_features" CASCADE;
    DROP TABLE IF EXISTS "plans" CASCADE;

    DROP TYPE IF EXISTS "public"."enum_plans_type";
    DROP TYPE IF EXISTS "public"."enum_plans_status";
    DROP TYPE IF EXISTS "public"."enum_plans_price_information_interval";
    DROP TYPE IF EXISTS "public"."enum_plans_sessions_information_interval";
  `)
}
