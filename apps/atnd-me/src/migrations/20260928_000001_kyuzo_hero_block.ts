import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** Adds the Kyuzo hero block and enables it for the Dark Horse tenant. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE 'kyuzoHero' BEFORE 'threeColumnLayout';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS "pages_blocks_kyuzo_hero" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "heading" varchar NOT NULL,
      "subheading" varchar NOT NULL,
      "background_image_id" integer NOT NULL,
      "cta1_text" varchar NOT NULL,
      "cta1_link" varchar NOT NULL,
      "cta2_text" varchar NOT NULL,
      "cta2_link" varchar NOT NULL,
      "form_title" varchar NOT NULL,
      "form_description" varchar NOT NULL,
      "form_id" integer NOT NULL,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_kyuzo_hero" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "heading" varchar NOT NULL,
      "subheading" varchar NOT NULL,
      "background_image_id" integer NOT NULL,
      "cta1_text" varchar NOT NULL,
      "cta1_link" varchar NOT NULL,
      "cta2_text" varchar NOT NULL,
      "cta2_link" varchar NOT NULL,
      "form_title" varchar NOT NULL,
      "form_description" varchar NOT NULL,
      "form_id" integer NOT NULL,
      "_uuid" varchar,
      "block_name" varchar
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_kyuzo_hero"
        ADD CONSTRAINT "pages_blocks_kyuzo_hero_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_kyuzo_hero"
        ADD CONSTRAINT "pages_blocks_kyuzo_hero_background_image_id_media_id_fk"
        FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_kyuzo_hero"
        ADD CONSTRAINT "pages_blocks_kyuzo_hero_form_id_forms_id_fk"
        FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_kyuzo_hero"
        ADD CONSTRAINT "_pages_v_blocks_kyuzo_hero_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_kyuzo_hero"
        ADD CONSTRAINT "_pages_v_blocks_kyuzo_hero_background_image_id_media_id_fk"
        FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_kyuzo_hero"
        ADD CONSTRAINT "_pages_v_blocks_kyuzo_hero_form_id_forms_id_fk"
        FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "pages_blocks_kyuzo_hero_order_idx"
      ON "pages_blocks_kyuzo_hero" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_kyuzo_hero_parent_id_idx"
      ON "pages_blocks_kyuzo_hero" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_kyuzo_hero_path_idx"
      ON "pages_blocks_kyuzo_hero" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_kyuzo_hero_background_image_idx"
      ON "pages_blocks_kyuzo_hero" USING btree ("background_image_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_kyuzo_hero_form_idx"
      ON "pages_blocks_kyuzo_hero" USING btree ("form_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_kyuzo_hero_order_idx"
      ON "_pages_v_blocks_kyuzo_hero" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_kyuzo_hero_parent_id_idx"
      ON "_pages_v_blocks_kyuzo_hero" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_kyuzo_hero_path_idx"
      ON "_pages_v_blocks_kyuzo_hero" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_kyuzo_hero_background_image_idx"
      ON "_pages_v_blocks_kyuzo_hero" USING btree ("background_image_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_kyuzo_hero_form_idx"
      ON "_pages_v_blocks_kyuzo_hero" USING btree ("form_id");
  `)

}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "_pages_v_blocks_kyuzo_hero" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_kyuzo_hero" CASCADE;
  `)
}
