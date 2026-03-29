import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Create booking_transactions table for @repo/bookings-payments.
 * Multi-tenant adds tenant_id; include it for atnd-me.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "booking_transactions" (
      "id" serial PRIMARY KEY NOT NULL,
      "booking_id" integer NOT NULL,
      "payment_method" varchar NOT NULL,
      "class_pass_id" integer,
      "stripe_payment_intent_id" varchar,
      "tenant_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)
  await db.execute(sql`
    ALTER TABLE "booking_transactions"
      ADD CONSTRAINT "booking_transactions_booking_id_bookings_id_fk"
      FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
  `)
  await db.execute(sql`
    ALTER TABLE "booking_transactions"
      ADD CONSTRAINT "booking_transactions_tenant_id_tenants_id_fk"
      FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "booking_transactions_booking_id_idx" ON "booking_transactions" ("booking_id");
    CREATE INDEX IF NOT EXISTS "booking_transactions_tenant_id_idx" ON "booking_transactions" ("tenant_id");
    CREATE INDEX IF NOT EXISTS "booking_transactions_updated_at_idx" ON "booking_transactions" ("updated_at");
    CREATE INDEX IF NOT EXISTS "booking_transactions_created_at_idx" ON "booking_transactions" ("created_at");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "booking_transactions"`)
}
