import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Days until expiration on class pass types: purchased passes expire N calendar days after purchase.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'class_pass_types') THEN
        ALTER TABLE "class_pass_types"
          ADD COLUMN IF NOT EXISTS "days_until_expiration" numeric DEFAULT 365;
        UPDATE "class_pass_types"
          SET "days_until_expiration" = 365
          WHERE "days_until_expiration" IS NULL;
        ALTER TABLE "class_pass_types"
          ALTER COLUMN "days_until_expiration" SET NOT NULL;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'class_pass_types') THEN
        ALTER TABLE "class_pass_types"
          DROP COLUMN IF EXISTS "days_until_expiration";
      END IF;
    END $$;
  `)
}
