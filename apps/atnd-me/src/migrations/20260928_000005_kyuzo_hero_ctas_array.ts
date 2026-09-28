import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** Replaces Kyuzo's fixed CTA fields with a maximum-two CTA array. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_kyuzo_hero_ctas_style" AS ENUM('filled', 'outline');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum__pages_v_blocks_kyuzo_hero_ctas_style" AS ENUM('filled', 'outline');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS "pages_blocks_kyuzo_hero_ctas" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "text" varchar NOT NULL,
      "link" varchar NOT NULL,
      "style" "public"."enum_pages_blocks_kyuzo_hero_ctas_style" DEFAULT 'filled',
      "background_color" varchar,
      "text_color" varchar,
      "border_color" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_kyuzo_hero_ctas" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "text" varchar NOT NULL,
      "link" varchar NOT NULL,
      "style" "public"."enum__pages_v_blocks_kyuzo_hero_ctas_style" DEFAULT 'filled',
      "background_color" varchar,
      "text_color" varchar,
      "border_color" varchar,
      "_uuid" varchar
    );

    ALTER TABLE "pages_blocks_kyuzo_hero"
      ADD COLUMN IF NOT EXISTS "circle_color" varchar,
      ADD COLUMN IF NOT EXISTS "heading_color" varchar,
      ADD COLUMN IF NOT EXISTS "subheading_color" varchar;

    ALTER TABLE "_pages_v_blocks_kyuzo_hero"
      ADD COLUMN IF NOT EXISTS "circle_color" varchar,
      ADD COLUMN IF NOT EXISTS "heading_color" varchar,
      ADD COLUMN IF NOT EXISTS "subheading_color" varchar;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_kyuzo_hero_ctas"
        ADD CONSTRAINT "pages_blocks_kyuzo_hero_ctas_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "pages_blocks_kyuzo_hero"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_kyuzo_hero_ctas"
        ADD CONSTRAINT "_pages_v_blocks_kyuzo_hero_ctas_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "_pages_v_blocks_kyuzo_hero"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "pages_blocks_kyuzo_hero_ctas_order_idx"
      ON "pages_blocks_kyuzo_hero_ctas" ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_kyuzo_hero_ctas_parent_id_idx"
      ON "pages_blocks_kyuzo_hero_ctas" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_kyuzo_hero_ctas_order_idx"
      ON "_pages_v_blocks_kyuzo_hero_ctas" ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_kyuzo_hero_ctas_parent_id_idx"
      ON "_pages_v_blocks_kyuzo_hero_ctas" ("_parent_id");
  `)

  await db.execute(sql`
    INSERT INTO "pages_blocks_kyuzo_hero_ctas" (
      "_order", "_parent_id", "id", "text", "link", "style",
      "background_color", "text_color", "border_color"
    )
    SELECT
      0, "id", "id" || '_cta1', "cta1_text", "cta1_link",
      COALESCE("cta1_style", 'filled')::"public"."enum_pages_blocks_kyuzo_hero_ctas_style",
      "cta1_backgroundcolor", "cta1_textcolor", "cta1_bordercolor"
    FROM "pages_blocks_kyuzo_hero"
    WHERE "cta1_text" IS NOT NULL
      AND "cta1_link" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "pages_blocks_kyuzo_hero_ctas" c
        WHERE c."_parent_id" = "pages_blocks_kyuzo_hero"."id"
          AND c."_order" = 0
      );

    INSERT INTO "pages_blocks_kyuzo_hero_ctas" (
      "_order", "_parent_id", "id", "text", "link", "style",
      "background_color", "text_color", "border_color"
    )
    SELECT
      1, "id", "id" || '_cta2', "cta2_text", "cta2_link",
      COALESCE("cta2_style", 'outline')::"public"."enum_pages_blocks_kyuzo_hero_ctas_style",
      "cta2_backgroundcolor", "cta2_textcolor", "cta2_bordercolor"
    FROM "pages_blocks_kyuzo_hero"
    WHERE "cta2_text" IS NOT NULL
      AND "cta2_link" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "pages_blocks_kyuzo_hero_ctas" c
        WHERE c."_parent_id" = "pages_blocks_kyuzo_hero"."id"
          AND c."_order" = 1
      );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_kyuzo_hero_ctas"
      DROP CONSTRAINT IF EXISTS "pages_blocks_kyuzo_hero_ctas_parent_id_fk";
    ALTER TABLE "_pages_v_blocks_kyuzo_hero_ctas"
      DROP CONSTRAINT IF EXISTS "_pages_v_blocks_kyuzo_hero_ctas_parent_id_fk";
    DROP TABLE IF EXISTS "_pages_v_blocks_kyuzo_hero_ctas";
    DROP TABLE IF EXISTS "pages_blocks_kyuzo_hero_ctas";
    ALTER TABLE "pages_blocks_kyuzo_hero"
      DROP COLUMN IF EXISTS "circle_color",
      DROP COLUMN IF EXISTS "heading_color",
      DROP COLUMN IF EXISTS "subheading_color";
    ALTER TABLE "_pages_v_blocks_kyuzo_hero"
      DROP COLUMN IF EXISTS "circle_color",
      DROP COLUMN IF EXISTS "heading_color",
      DROP COLUMN IF EXISTS "subheading_color";
    DROP TYPE IF EXISTS "public"."enum__pages_v_blocks_kyuzo_hero_ctas_style";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_kyuzo_hero_ctas_style";
  `)
}
