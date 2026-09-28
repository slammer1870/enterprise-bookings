import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** Adds optional colors, overlay controls, and optional CTA styling to Kyuzo hero blocks. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_kyuzo_hero"
      ALTER COLUMN "cta1_text" DROP NOT NULL,
      ALTER COLUMN "cta1_link" DROP NOT NULL,
      ALTER COLUMN "cta2_text" DROP NOT NULL,
      ALTER COLUMN "cta2_link" DROP NOT NULL,
      ADD COLUMN IF NOT EXISTS "panel_background_color" varchar,
      ADD COLUMN IF NOT EXISTS "overlay_color" varchar,
      ADD COLUMN IF NOT EXISTS "overlay_opacity" numeric,
      ADD COLUMN IF NOT EXISTS "cta1_style" varchar,
      ADD COLUMN IF NOT EXISTS "cta1_background_color" varchar,
      ADD COLUMN IF NOT EXISTS "cta1_text_color" varchar,
      ADD COLUMN IF NOT EXISTS "cta1_border_color" varchar,
      ADD COLUMN IF NOT EXISTS "cta2_style" varchar,
      ADD COLUMN IF NOT EXISTS "cta2_background_color" varchar,
      ADD COLUMN IF NOT EXISTS "cta2_text_color" varchar,
      ADD COLUMN IF NOT EXISTS "cta2_border_color" varchar;

    ALTER TABLE "_pages_v_blocks_kyuzo_hero"
      ALTER COLUMN "cta1_text" DROP NOT NULL,
      ALTER COLUMN "cta1_link" DROP NOT NULL,
      ALTER COLUMN "cta2_text" DROP NOT NULL,
      ALTER COLUMN "cta2_link" DROP NOT NULL,
      ADD COLUMN IF NOT EXISTS "panel_background_color" varchar,
      ADD COLUMN IF NOT EXISTS "overlay_color" varchar,
      ADD COLUMN IF NOT EXISTS "overlay_opacity" numeric,
      ADD COLUMN IF NOT EXISTS "cta1_style" varchar,
      ADD COLUMN IF NOT EXISTS "cta1_background_color" varchar,
      ADD COLUMN IF NOT EXISTS "cta1_text_color" varchar,
      ADD COLUMN IF NOT EXISTS "cta1_border_color" varchar,
      ADD COLUMN IF NOT EXISTS "cta2_style" varchar,
      ADD COLUMN IF NOT EXISTS "cta2_background_color" varchar,
      ADD COLUMN IF NOT EXISTS "cta2_text_color" varchar,
      ADD COLUMN IF NOT EXISTS "cta2_border_color" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_kyuzo_hero"
      DROP COLUMN IF EXISTS "panel_background_color",
      DROP COLUMN IF EXISTS "overlay_color",
      DROP COLUMN IF EXISTS "overlay_opacity",
      DROP COLUMN IF EXISTS "cta1_style",
      DROP COLUMN IF EXISTS "cta1_background_color",
      DROP COLUMN IF EXISTS "cta1_text_color",
      DROP COLUMN IF EXISTS "cta1_border_color",
      DROP COLUMN IF EXISTS "cta2_style",
      DROP COLUMN IF EXISTS "cta2_background_color",
      DROP COLUMN IF EXISTS "cta2_text_color",
      DROP COLUMN IF EXISTS "cta2_border_color";

    ALTER TABLE "_pages_v_blocks_kyuzo_hero"
      DROP COLUMN IF EXISTS "panel_background_color",
      DROP COLUMN IF EXISTS "overlay_color",
      DROP COLUMN IF EXISTS "overlay_opacity",
      DROP COLUMN IF EXISTS "cta1_style",
      DROP COLUMN IF EXISTS "cta1_background_color",
      DROP COLUMN IF EXISTS "cta1_text_color",
      DROP COLUMN IF EXISTS "cta1_border_color",
      DROP COLUMN IF EXISTS "cta2_style",
      DROP COLUMN IF EXISTS "cta2_background_color",
      DROP COLUMN IF EXISTS "cta2_text_color",
      DROP COLUMN IF EXISTS "cta2_border_color";
  `)
}
