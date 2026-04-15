import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * `clFindSanctuary` block: add `map_embed_url` to match Payload field `mapEmbedUrl`.
 *
 * Tables were created in `20260414_155751_croi_lan_sauna_blocks` without this column.
 * Idempotent (duplicate_column ignored).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_cl_find_sanctuary" ADD COLUMN "map_embed_url" varchar DEFAULT 'https://maps.google.com/maps?q=The+Bog+Meadow%2C+Enniskerry%2C+Co.+Wicklow&hl=en&z=15&output=embed';
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_cl_find_sanctuary" ADD COLUMN "map_embed_url" varchar DEFAULT 'https://maps.google.com/maps?q=The+Bog+Meadow%2C+Enniskerry%2C+Co.+Wicklow&hl=en&z=15&output=embed';
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_cl_find_sanctuary" DROP COLUMN IF EXISTS "map_embed_url";
    ALTER TABLE "_pages_v_blocks_cl_find_sanctuary" DROP COLUMN IF EXISTS "map_embed_url";
  `)
}
