import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Import/export plugin schema only.
 *
 * The auto-generated snapshot duplicated many objects already created by prior
 * incremental migrations (post-booking emails, locations, users_tenants_roles, etc.).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_exports_format" AS ENUM('csv', 'json');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_exports_sort_order" AS ENUM('asc', 'desc');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_exports_drafts" AS ENUM('yes', 'no');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'createCollectionExport'
          AND enumtypid = 'public.enum_payload_jobs_task_slug'::regtype
      ) THEN
        ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'createCollectionExport';
      END IF;
    END
    $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'createCollectionExport'
          AND enumtypid = 'public.enum_payload_jobs_log_task_slug'::regtype
      ) THEN
        ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'createCollectionExport';
      END IF;
    END
    $$;

    CREATE TABLE IF NOT EXISTS "exports" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar,
      "format" "enum_exports_format" DEFAULT 'csv',
      "limit" numeric,
      "page" numeric DEFAULT 1,
      "sort" varchar,
      "sort_order" "enum_exports_sort_order",
      "drafts" "enum_exports_drafts" DEFAULT 'yes',
      "collection_slug" varchar NOT NULL,
      "where" jsonb DEFAULT '{}'::jsonb,
      "requested_by_id" integer,
      "tenant_scope" numeric,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "url" varchar,
      "thumbnail_u_r_l" varchar,
      "filename" varchar,
      "mime_type" varchar,
      "filesize" numeric,
      "width" numeric,
      "height" numeric,
      "focal_x" numeric,
      "focal_y" numeric
    );

    CREATE TABLE IF NOT EXISTS "exports_texts" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "text" varchar
    );

    DO $$ BEGIN
      ALTER TABLE "exports"
        ADD CONSTRAINT "exports_requested_by_id_users_id_fk"
        FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "exports_texts"
        ADD CONSTRAINT "exports_texts_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."exports"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "exports_requested_by_idx"
      ON "exports" USING btree ("requested_by_id");
    CREATE INDEX IF NOT EXISTS "exports_updated_at_idx"
      ON "exports" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "exports_created_at_idx"
      ON "exports" USING btree ("created_at");
    CREATE UNIQUE INDEX IF NOT EXISTS "exports_filename_idx"
      ON "exports" USING btree ("filename");
    CREATE INDEX IF NOT EXISTS "exports_texts_order_parent"
      ON "exports_texts" USING btree ("order", "parent_id");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "exports_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_exports_fk"
        FOREIGN KEY ("exports_id") REFERENCES "public"."exports"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_exports_id_idx"
      ON "payload_locked_documents_rels" USING btree ("exports_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_exports_id_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_exports_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "exports_id";

    DROP TABLE IF EXISTS "exports_texts" CASCADE;
    DROP TABLE IF EXISTS "exports" CASCADE;

    DROP TYPE IF EXISTS "public"."enum_exports_drafts";
    DROP TYPE IF EXISTS "public"."enum_exports_sort_order";
    DROP TYPE IF EXISTS "public"."enum_exports_format";
  `)
}
