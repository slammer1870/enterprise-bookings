import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Holohan Wellness HwHeroServices block (packages/website/src/blocks/holohan-wellness/HwHeroServices).
 *
 * - Adds 'hwHeroServices' to enum_tenants_allowed_blocks
 * - Creates pages_blocks_hw_hero_services + services array child table
 * - Creates versioned equivalents (_pages_v_*)
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE 'hwHeroServices' BEFORE 'threeColumnLayout';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_hw_hero_services" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "logo_id" integer,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_hw_hero_services_services" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "icon_id" integer,
      "label" varchar NOT NULL,
      "url" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_hw_hero_services" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "logo_id" integer,
      "_uuid" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_hw_hero_services_services" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "icon_id" integer,
      "label" varchar NOT NULL,
      "url" varchar,
      "_uuid" varchar
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_hw_hero_services" ADD CONSTRAINT "pages_blocks_hw_hero_services_logo_id_media_id_fk"
        FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_hw_hero_services" ADD CONSTRAINT "pages_blocks_hw_hero_services_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_hw_hero_services_services" ADD CONSTRAINT "pages_blocks_hw_hero_services_services_icon_id_media_id_fk"
        FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_hw_hero_services_services" ADD CONSTRAINT "pages_blocks_hw_hero_services_services_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_hw_hero_services"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_hw_hero_services" ADD CONSTRAINT "_pages_v_blocks_hw_hero_services_logo_id_media_id_fk"
        FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_hw_hero_services" ADD CONSTRAINT "_pages_v_blocks_hw_hero_services_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_hw_hero_services_services" ADD CONSTRAINT "_pages_v_blocks_hw_hero_services_services_icon_id_media_id_fk"
        FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_hw_hero_services_services" ADD CONSTRAINT "_pages_v_blocks_hw_hero_services_services_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_hw_hero_services"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "pages_blocks_hw_hero_services_order_idx" ON "pages_blocks_hw_hero_services" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_hw_hero_services_parent_id_idx" ON "pages_blocks_hw_hero_services" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_hw_hero_services_path_idx" ON "pages_blocks_hw_hero_services" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_hw_hero_services_logo_idx" ON "pages_blocks_hw_hero_services" USING btree ("logo_id");

    CREATE INDEX IF NOT EXISTS "pages_blocks_hw_hero_services_services_order_idx" ON "pages_blocks_hw_hero_services_services" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_hw_hero_services_services_parent_id_idx" ON "pages_blocks_hw_hero_services_services" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_hw_hero_services_services_icon_idx" ON "pages_blocks_hw_hero_services_services" USING btree ("icon_id");

    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_hw_hero_services_order_idx" ON "_pages_v_blocks_hw_hero_services" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_hw_hero_services_parent_id_idx" ON "_pages_v_blocks_hw_hero_services" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_hw_hero_services_path_idx" ON "_pages_v_blocks_hw_hero_services" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_hw_hero_services_logo_idx" ON "_pages_v_blocks_hw_hero_services" USING btree ("logo_id");

    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_hw_hero_services_services_order_idx" ON "_pages_v_blocks_hw_hero_services_services" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_hw_hero_services_services_parent_id_idx" ON "_pages_v_blocks_hw_hero_services_services" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_hw_hero_services_services_icon_idx" ON "_pages_v_blocks_hw_hero_services_services" USING btree ("icon_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "_pages_v_blocks_hw_hero_services_services" CASCADE;
    DROP TABLE IF EXISTS "_pages_v_blocks_hw_hero_services" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_hw_hero_services_services" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_hw_hero_services" CASCADE;
  `)

  // Enum values cannot be removed safely in Postgres; leave enum_tenants_allowed_blocks extended.
}
