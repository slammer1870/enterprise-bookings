import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Create `users_stripe_customers` array table used by Stripe Connect / payments integrations.
 *
 * Additive + idempotent so it is safe for rolling deploys and CI.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "users_stripe_customers" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "stripe_account_id" varchar,
      "stripe_customer_id" varchar
    );

    DO $$ BEGIN
      ALTER TABLE "users_stripe_customers"
        ADD CONSTRAINT "users_stripe_customers_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id")
        ON DELETE cascade
        ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "users_stripe_customers_order_idx"
      ON "users_stripe_customers" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "users_stripe_customers_parent_id_idx"
      ON "users_stripe_customers" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "users_stripe_customers_stripe_account_id_idx"
      ON "users_stripe_customers" USING btree ("stripe_account_id");
    CREATE INDEX IF NOT EXISTS "users_stripe_customers_stripe_customer_id_idx"
      ON "users_stripe_customers" USING btree ("stripe_customer_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "users_stripe_customers" CASCADE;
  `)
}

