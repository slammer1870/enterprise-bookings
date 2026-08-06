import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * - drop_ins.once_per_user: limit each customer to one purchase of that drop-in product
 * - booking_transactions.drop_in_id: stamp which drop-in product paid for the booking
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'drop_ins'
      ) THEN
        ALTER TABLE "drop_ins"
          ADD COLUMN IF NOT EXISTS "once_per_user" boolean DEFAULT false;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'booking_transactions'
      ) THEN
        ALTER TABLE "booking_transactions"
          ADD COLUMN IF NOT EXISTS "drop_in_id" numeric;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'drop_ins'
      ) THEN
        ALTER TABLE "drop_ins"
          DROP COLUMN IF EXISTS "once_per_user";
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'booking_transactions'
      ) THEN
        ALTER TABLE "booking_transactions"
          DROP COLUMN IF EXISTS "drop_in_id";
      END IF;
    END $$;
  `)
}
