import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Payload lock-document queries reference every registered collection slug on
 * payload_locked_documents_rels. Add booking_checkout_holds_id after the
 * booking-checkout-holds collection is registered.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "booking_checkout_holds_id" integer;

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_booking_checkout_holds_fk'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels"
          ADD CONSTRAINT "payload_locked_documents_rels_booking_checkout_holds_fk"
          FOREIGN KEY ("booking_checkout_holds_id")
          REFERENCES "public"."booking_checkout_holds"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_booking_checkout_holds_id_idx"
      ON "payload_locked_documents_rels" USING btree ("booking_checkout_holds_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_booking_checkout_holds_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_booking_checkout_holds_id_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "booking_checkout_holds_id";
  `)
}
