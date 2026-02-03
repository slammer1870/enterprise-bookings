import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Create class_passes table for @repo/bookings-payments class-passes collection.
 * Multi-tenant adds tenant_id; include it for atnd-me.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "class_passes" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "tenant_id" integer,
      "quantity" integer NOT NULL,
      "original_quantity" integer NOT NULL,
      "expiration_date" timestamp(3) with time zone NOT NULL,
      "purchased_at" timestamp(3) with time zone NOT NULL,
      "price" integer NOT NULL,
      "transaction_id" varchar,
      "status" varchar DEFAULT 'active' NOT NULL,
      "notes" text,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)
  await db.execute(sql`
    ALTER TABLE "class_passes"
      ADD CONSTRAINT "class_passes_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  `)
  await db.execute(sql`
    ALTER TABLE "class_passes"
      ADD CONSTRAINT "class_passes_tenant_id_tenants_id_fk"
      FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "class_passes_user_id_idx" ON "class_passes" ("user_id");
    CREATE INDEX IF NOT EXISTS "class_passes_tenant_id_idx" ON "class_passes" ("tenant_id");
    CREATE INDEX IF NOT EXISTS "class_passes_updated_at_idx" ON "class_passes" ("updated_at");
    CREATE INDEX IF NOT EXISTS "class_passes_created_at_idx" ON "class_passes" ("created_at");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "class_passes"`)
}
