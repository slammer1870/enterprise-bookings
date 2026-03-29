import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Create bookings_rels table for the bookings.transactions hasMany relationship
 * (injected by @repo/bookings-payments). Payload/Drizzle expect this table when
 * querying bookings with depth so the relationship join works.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "bookings_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "booking_transactions_id" integer
    );
    DO $$ BEGIN ALTER TABLE "bookings_rels" ADD CONSTRAINT "bookings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "bookings_rels" ADD CONSTRAINT "bookings_rels_booking_transactions_fk" FOREIGN KEY ("booking_transactions_id") REFERENCES "public"."booking_transactions"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "bookings_rels_order_idx" ON "bookings_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "bookings_rels_parent_idx" ON "bookings_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "bookings_rels_path_idx" ON "bookings_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "bookings_rels_booking_transactions_id_idx" ON "bookings_rels" USING btree ("booking_transactions_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "bookings_rels" CASCADE;
  `)
}
