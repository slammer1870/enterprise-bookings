import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * The plan collection was renamed to memberships (bookings-payments uses slug "memberships").
 * Rename any legacy *_rels.plans_id columns to memberships_id so Payload's relationship queries
 * match the current schema when running with `push: false` in CI/test.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'payload_locked_documents_rels'
          AND column_name = 'plans_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels"
          DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_plans_fk";
        DROP INDEX IF EXISTS "payload_locked_documents_rels_plans_id_idx";
        ALTER TABLE "payload_locked_documents_rels"
          RENAME COLUMN "plans_id" TO "memberships_id";
        IF to_regclass('public.memberships') IS NOT NULL THEN
          ALTER TABLE "payload_locked_documents_rels"
            ADD CONSTRAINT "payload_locked_documents_rels_memberships_fk"
            FOREIGN KEY ("memberships_id") REFERENCES "public"."memberships"("id")
            ON DELETE cascade ON UPDATE no action;
        END IF;
        CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_memberships_id_idx"
          ON "payload_locked_documents_rels" USING btree ("memberships_id");
      ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'payload_locked_documents_rels'
          AND column_name = 'memberships_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "memberships_id" integer;
        IF to_regclass('public.memberships') IS NOT NULL THEN
          ALTER TABLE "payload_locked_documents_rels"
            ADD CONSTRAINT "payload_locked_documents_rels_memberships_fk"
            FOREIGN KEY ("memberships_id") REFERENCES "public"."memberships"("id")
            ON DELETE cascade ON UPDATE no action;
        END IF;
        CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_memberships_id_idx"
          ON "payload_locked_documents_rels" USING btree ("memberships_id");
      END IF;
    END $$;
  `)

  // class_options_rels: paymentMethods.allowedPlans now points to memberships
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'class_options_rels'
          AND column_name = 'plans_id'
      ) THEN
        ALTER TABLE "class_options_rels"
          DROP CONSTRAINT IF EXISTS "class_options_rels_plans_fk";
        DROP INDEX IF EXISTS "class_options_rels_plans_id_idx";
        ALTER TABLE "class_options_rels"
          RENAME COLUMN "plans_id" TO "memberships_id";
        IF to_regclass('public.memberships') IS NOT NULL THEN
          ALTER TABLE "class_options_rels"
            ADD CONSTRAINT "class_options_rels_memberships_fk"
            FOREIGN KEY ("memberships_id") REFERENCES "public"."memberships"("id")
            ON DELETE cascade ON UPDATE no action;
        END IF;
        CREATE INDEX IF NOT EXISTS "class_options_rels_memberships_id_idx"
          ON "class_options_rels" USING btree ("memberships_id");
      ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'class_options_rels'
          AND column_name = 'memberships_id'
      ) THEN
        ALTER TABLE "class_options_rels" ADD COLUMN "memberships_id" integer;
        IF to_regclass('public.memberships') IS NOT NULL THEN
          ALTER TABLE "class_options_rels"
            ADD CONSTRAINT "class_options_rels_memberships_fk"
            FOREIGN KEY ("memberships_id") REFERENCES "public"."memberships"("id")
            ON DELETE cascade ON UPDATE no action;
        END IF;
        CREATE INDEX IF NOT EXISTS "class_options_rels_memberships_id_idx"
          ON "class_options_rels" USING btree ("memberships_id");
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'payload_locked_documents_rels'
          AND column_name = 'memberships_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels"
          DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_memberships_fk";
        DROP INDEX IF EXISTS "payload_locked_documents_rels_memberships_id_idx";
        ALTER TABLE "payload_locked_documents_rels"
          RENAME COLUMN "memberships_id" TO "plans_id";
        IF to_regclass('public.plans') IS NOT NULL THEN
          ALTER TABLE "payload_locked_documents_rels"
            ADD CONSTRAINT "payload_locked_documents_rels_plans_fk"
            FOREIGN KEY ("plans_id") REFERENCES "public"."plans"("id")
            ON DELETE cascade ON UPDATE no action;
        END IF;
        CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_plans_id_idx"
          ON "payload_locked_documents_rels" USING btree ("plans_id");
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'class_options_rels'
          AND column_name = 'memberships_id'
      ) THEN
        ALTER TABLE "class_options_rels"
          DROP CONSTRAINT IF EXISTS "class_options_rels_memberships_fk";
        DROP INDEX IF EXISTS "class_options_rels_memberships_id_idx";
        ALTER TABLE "class_options_rels"
          RENAME COLUMN "memberships_id" TO "plans_id";
        IF to_regclass('public.plans') IS NOT NULL THEN
          ALTER TABLE "class_options_rels"
            ADD CONSTRAINT "class_options_rels_plans_fk"
            FOREIGN KEY ("plans_id") REFERENCES "public"."plans"("id")
            ON DELETE cascade ON UPDATE no action;
        END IF;
        CREATE INDEX IF NOT EXISTS "class_options_rels_plans_id_idx"
          ON "class_options_rels" USING btree ("plans_id");
      END IF;
    END $$;
  `)
}
