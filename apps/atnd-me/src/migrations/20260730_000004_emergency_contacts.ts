import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Creates emergency-contacts collection tables (family form per account holder).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_emergency_contacts_status" AS ENUM('incomplete', 'complete');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_emergency_contacts_people_person_type" AS ENUM('self', 'child', 'other');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS "emergency_contacts" (
      "id" serial PRIMARY KEY NOT NULL,
      "tenant_id" integer,
      "user_id" integer NOT NULL,
      "status" "enum_emergency_contacts_status" DEFAULT 'incomplete' NOT NULL,
      "completed_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "emergency_contacts_people" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "full_name" varchar NOT NULL,
      "person_type" "enum_emergency_contacts_people_person_type" DEFAULT 'self' NOT NULL,
      "medical_notes" varchar
    );

    CREATE TABLE IF NOT EXISTS "emergency_contacts_people_contacts" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "phone" varchar NOT NULL,
      "relationship" varchar NOT NULL
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "emergency_contacts"
        ADD CONSTRAINT "emergency_contacts_tenant_id_tenants_id_fk"
        FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "emergency_contacts"
        ADD CONSTRAINT "emergency_contacts_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "emergency_contacts_people"
        ADD CONSTRAINT "emergency_contacts_people_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."emergency_contacts"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "emergency_contacts_people_contacts"
        ADD CONSTRAINT "emergency_contacts_people_contacts_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."emergency_contacts_people"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "emergency_contacts_tenant_idx"
      ON "emergency_contacts" USING btree ("tenant_id");
    CREATE INDEX IF NOT EXISTS "emergency_contacts_user_idx"
      ON "emergency_contacts" USING btree ("user_id");
    CREATE INDEX IF NOT EXISTS "emergency_contacts_status_idx"
      ON "emergency_contacts" USING btree ("status");
    CREATE INDEX IF NOT EXISTS "emergency_contacts_updated_at_idx"
      ON "emergency_contacts" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "emergency_contacts_created_at_idx"
      ON "emergency_contacts" USING btree ("created_at");
    CREATE UNIQUE INDEX IF NOT EXISTS "emergency_contacts_tenant_user_idx"
      ON "emergency_contacts" USING btree ("tenant_id", "user_id");

    CREATE INDEX IF NOT EXISTS "emergency_contacts_people_order_idx"
      ON "emergency_contacts_people" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "emergency_contacts_people_parent_id_idx"
      ON "emergency_contacts_people" USING btree ("_parent_id");

    CREATE INDEX IF NOT EXISTS "emergency_contacts_people_contacts_order_idx"
      ON "emergency_contacts_people_contacts" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "emergency_contacts_people_contacts_parent_id_idx"
      ON "emergency_contacts_people_contacts" USING btree ("_parent_id");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "emergency_contacts_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_emergency_contacts_fk"
        FOREIGN KEY ("emergency_contacts_id")
        REFERENCES "public"."emergency_contacts"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_emergency_contacts_id_idx"
      ON "payload_locked_documents_rels" USING btree ("emergency_contacts_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_emergency_contacts_id_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_emergency_contacts_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "emergency_contacts_id";

    DROP TABLE IF EXISTS "emergency_contacts_people_contacts" CASCADE;
    DROP TABLE IF EXISTS "emergency_contacts_people" CASCADE;
    DROP TABLE IF EXISTS "emergency_contacts" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_emergency_contacts_people_person_type";
    DROP TYPE IF EXISTS "public"."enum_emergency_contacts_status";
  `)
}
