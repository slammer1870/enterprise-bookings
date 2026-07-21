import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * MarketingHero: add `showUsernameClaim` checkbox field
 * (`show_username_claim` column) so page queries no longer fail.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pages_blocks_marketing_hero'
          AND column_name = 'show_username_claim'
      ) THEN
        ALTER TABLE "pages_blocks_marketing_hero"
          ADD COLUMN "show_username_claim" boolean DEFAULT false;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '_pages_v_blocks_marketing_hero'
          AND column_name = 'show_username_claim'
      ) THEN
        ALTER TABLE "_pages_v_blocks_marketing_hero"
          ADD COLUMN "show_username_claim" boolean DEFAULT false;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_marketing_hero" DROP COLUMN IF EXISTS "show_username_claim";
    ALTER TABLE "_pages_v_blocks_marketing_hero" DROP COLUMN IF EXISTS "show_username_claim";
  `)
}
