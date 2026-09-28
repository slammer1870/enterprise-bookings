import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_kyuzo_hero"
      RENAME COLUMN "cta1_background_color" TO "cta1_backgroundcolor";
    ALTER TABLE "pages_blocks_kyuzo_hero"
      RENAME COLUMN "cta1_text_color" TO "cta1_textcolor";
    ALTER TABLE "pages_blocks_kyuzo_hero"
      RENAME COLUMN "cta1_border_color" TO "cta1_bordercolor";
    ALTER TABLE "pages_blocks_kyuzo_hero"
      RENAME COLUMN "cta2_background_color" TO "cta2_backgroundcolor";
    ALTER TABLE "pages_blocks_kyuzo_hero"
      RENAME COLUMN "cta2_text_color" TO "cta2_textcolor";
    ALTER TABLE "pages_blocks_kyuzo_hero"
      RENAME COLUMN "cta2_border_color" TO "cta2_bordercolor";

    ALTER TABLE "_pages_v_blocks_kyuzo_hero"
      RENAME COLUMN "cta1_background_color" TO "cta1_backgroundcolor";
    ALTER TABLE "_pages_v_blocks_kyuzo_hero"
      RENAME COLUMN "cta1_text_color" TO "cta1_textcolor";
    ALTER TABLE "_pages_v_blocks_kyuzo_hero"
      RENAME COLUMN "cta1_border_color" TO "cta1_bordercolor";
    ALTER TABLE "_pages_v_blocks_kyuzo_hero"
      RENAME COLUMN "cta2_background_color" TO "cta2_backgroundcolor";
    ALTER TABLE "_pages_v_blocks_kyuzo_hero"
      RENAME COLUMN "cta2_text_color" TO "cta2_textcolor";
    ALTER TABLE "_pages_v_blocks_kyuzo_hero"
      RENAME COLUMN "cta2_border_color" TO "cta2_bordercolor";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_kyuzo_hero"
      RENAME COLUMN "cta1_backgroundcolor" TO "cta1_background_color";
    ALTER TABLE "pages_blocks_kyuzo_hero"
      RENAME COLUMN "cta1_textcolor" TO "cta1_text_color";
    ALTER TABLE "pages_blocks_kyuzo_hero"
      RENAME COLUMN "cta1_bordercolor" TO "cta1_border_color";
    ALTER TABLE "pages_blocks_kyuzo_hero"
      RENAME COLUMN "cta2_backgroundcolor" TO "cta2_background_color";
    ALTER TABLE "pages_blocks_kyuzo_hero"
      RENAME COLUMN "cta2_textcolor" TO "cta2_text_color";
    ALTER TABLE "pages_blocks_kyuzo_hero"
      RENAME COLUMN "cta2_bordercolor" TO "cta2_border_color";

    ALTER TABLE "_pages_v_blocks_kyuzo_hero"
      RENAME COLUMN "cta1_backgroundcolor" TO "cta1_background_color";
    ALTER TABLE "_pages_v_blocks_kyuzo_hero"
      RENAME COLUMN "cta1_textcolor" TO "cta1_text_color";
    ALTER TABLE "_pages_v_blocks_kyuzo_hero"
      RENAME COLUMN "cta1_bordercolor" TO "cta1_border_color";
    ALTER TABLE "_pages_v_blocks_kyuzo_hero"
      RENAME COLUMN "cta2_backgroundcolor" TO "cta2_background_color";
    ALTER TABLE "_pages_v_blocks_kyuzo_hero"
      RENAME COLUMN "cta2_textcolor" TO "cta2_text_color";
    ALTER TABLE "_pages_v_blocks_kyuzo_hero"
      RENAME COLUMN "cta2_bordercolor" TO "cta2_border_color";
  `)
}
