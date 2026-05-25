import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Checkout holds: ephemeral capacity reservations during payment.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "booking_checkout_holds" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "timeslot_id" integer NOT NULL,
      "tenant_id" integer,
      "quantity" numeric NOT NULL DEFAULT 1,
      "expires_at" timestamp(3) with time zone NOT NULL,
      "first_upserted_at" timestamp(3) with time zone,
      "status" varchar NOT NULL DEFAULT 'active',
      "stripe_payment_intent_id" varchar,
      "failure_reason" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  await db.execute(sql`
    ALTER TABLE "booking_checkout_holds"
      ADD CONSTRAINT "booking_checkout_holds_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  `)

  await db.execute(sql`
    ALTER TABLE "booking_checkout_holds"
      ADD CONSTRAINT "booking_checkout_holds_timeslot_id_timeslots_id_fk"
      FOREIGN KEY ("timeslot_id") REFERENCES "public"."timeslots"("id") ON DELETE cascade ON UPDATE no action;
  `)

  await db.execute(sql`
    ALTER TABLE "booking_checkout_holds"
      ADD CONSTRAINT "booking_checkout_holds_tenant_id_tenants_id_fk"
      FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "booking_checkout_holds_user_id_idx" ON "booking_checkout_holds" ("user_id");
    CREATE INDEX IF NOT EXISTS "booking_checkout_holds_timeslot_id_idx" ON "booking_checkout_holds" ("timeslot_id");
    CREATE INDEX IF NOT EXISTS "booking_checkout_holds_tenant_id_idx" ON "booking_checkout_holds" ("tenant_id");
    CREATE INDEX IF NOT EXISTS "booking_checkout_holds_status_idx" ON "booking_checkout_holds" ("status");
    CREATE INDEX IF NOT EXISTS "booking_checkout_holds_expires_at_idx" ON "booking_checkout_holds" ("expires_at");
    CREATE INDEX IF NOT EXISTS "booking_checkout_holds_timeslot_status_expires_idx"
      ON "booking_checkout_holds" ("timeslot_id", "status", "expires_at");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "booking_checkout_holds"`)
}
