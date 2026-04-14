import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Croí Lán Sauna tenant blocks (packages/website/src/blocks/croi-lan-sauna):
 * clFindSanctuary, clMission, clPillars, clSaunaBenefits + intro_tagline on clHeroLoc.
 *
 * Idempotent where possible (enums, intro_tagline column).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE 'clFindSanctuary' BEFORE 'threeColumnLayout';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE 'clMission' BEFORE 'threeColumnLayout';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE 'clPillars' BEFORE 'threeColumnLayout';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TYPE "public"."enum_tenants_allowed_blocks" ADD VALUE 'clSaunaBenefits' BEFORE 'threeColumnLayout';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_cl_hero_loc" ADD COLUMN "intro_tagline" varchar DEFAULT 'Here, warmth meets the soul. In the heart of Wicklow''s countryside, find restoration, renewal and leave with your heart full.';
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_cl_hero_loc" ADD COLUMN "intro_tagline" varchar DEFAULT 'Here, warmth meets the soul. In the heart of Wicklow''s countryside, find restoration, renewal and leave with your heart full.';
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_cl_find_sanctuary" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "heading" varchar DEFAULT 'Find Your Sanctuary',
      "address" varchar DEFAULT 'The Bog Meadow, Enniskerry Village, Co. Wicklow',
      "note" varchar DEFAULT 'Free parking available',
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_cl_mission" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "heading" varchar DEFAULT 'Filling the Heart, Restoring the Soul',
      "lede" varchar DEFAULT 'At Croí Lán, we believe a full heart comes from connection.',
      "body" jsonb,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_cl_pillars_items" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "label" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_cl_pillars" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_cl_sauna_benefits_items" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" varchar,
      "description" varchar
    );

    CREATE TABLE IF NOT EXISTS "pages_blocks_cl_sauna_benefits" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "section_title" varchar DEFAULT 'Health Benefits of Sauna',
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_cl_find_sanctuary" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "heading" varchar DEFAULT 'Find Your Sanctuary',
      "address" varchar DEFAULT 'The Bog Meadow, Enniskerry Village, Co. Wicklow',
      "note" varchar DEFAULT 'Free parking available',
      "_uuid" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_cl_mission" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "heading" varchar DEFAULT 'Filling the Heart, Restoring the Soul',
      "lede" varchar DEFAULT 'At Croí Lán, we believe a full heart comes from connection.',
      "body" jsonb,
      "_uuid" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_cl_pillars_items" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "label" varchar,
      "_uuid" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_cl_pillars" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "_uuid" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_cl_sauna_benefits_items" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar,
      "description" varchar,
      "_uuid" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_cl_sauna_benefits" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "section_title" varchar DEFAULT 'Health Benefits of Sauna',
      "_uuid" varchar,
      "block_name" varchar
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_cl_find_sanctuary" ADD CONSTRAINT "pages_blocks_cl_find_sanctuary_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_cl_mission" ADD CONSTRAINT "pages_blocks_cl_mission_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_cl_pillars_items" ADD CONSTRAINT "pages_blocks_cl_pillars_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_cl_pillars"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_cl_pillars" ADD CONSTRAINT "pages_blocks_cl_pillars_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_cl_sauna_benefits_items" ADD CONSTRAINT "pages_blocks_cl_sauna_benefits_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_cl_sauna_benefits"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_cl_sauna_benefits" ADD CONSTRAINT "pages_blocks_cl_sauna_benefits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_cl_find_sanctuary" ADD CONSTRAINT "_pages_v_blocks_cl_find_sanctuary_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_cl_mission" ADD CONSTRAINT "_pages_v_blocks_cl_mission_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_cl_pillars_items" ADD CONSTRAINT "_pages_v_blocks_cl_pillars_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_cl_pillars"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_cl_pillars" ADD CONSTRAINT "_pages_v_blocks_cl_pillars_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_cl_sauna_benefits_items" ADD CONSTRAINT "_pages_v_blocks_cl_sauna_benefits_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_cl_sauna_benefits"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_cl_sauna_benefits" ADD CONSTRAINT "_pages_v_blocks_cl_sauna_benefits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_find_sanctuary_order_idx" ON "pages_blocks_cl_find_sanctuary" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_find_sanctuary_parent_id_idx" ON "pages_blocks_cl_find_sanctuary" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_find_sanctuary_path_idx" ON "pages_blocks_cl_find_sanctuary" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_mission_order_idx" ON "pages_blocks_cl_mission" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_mission_parent_id_idx" ON "pages_blocks_cl_mission" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_mission_path_idx" ON "pages_blocks_cl_mission" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_pillars_items_order_idx" ON "pages_blocks_cl_pillars_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_pillars_items_parent_id_idx" ON "pages_blocks_cl_pillars_items" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_pillars_order_idx" ON "pages_blocks_cl_pillars" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_pillars_parent_id_idx" ON "pages_blocks_cl_pillars" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_pillars_path_idx" ON "pages_blocks_cl_pillars" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_sauna_benefits_items_order_idx" ON "pages_blocks_cl_sauna_benefits_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_sauna_benefits_items_parent_id_idx" ON "pages_blocks_cl_sauna_benefits_items" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_sauna_benefits_order_idx" ON "pages_blocks_cl_sauna_benefits" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_sauna_benefits_parent_id_idx" ON "pages_blocks_cl_sauna_benefits" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_cl_sauna_benefits_path_idx" ON "pages_blocks_cl_sauna_benefits" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_find_sanctuary_order_idx" ON "_pages_v_blocks_cl_find_sanctuary" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_find_sanctuary_parent_id_idx" ON "_pages_v_blocks_cl_find_sanctuary" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_find_sanctuary_path_idx" ON "_pages_v_blocks_cl_find_sanctuary" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_mission_order_idx" ON "_pages_v_blocks_cl_mission" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_mission_parent_id_idx" ON "_pages_v_blocks_cl_mission" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_mission_path_idx" ON "_pages_v_blocks_cl_mission" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_pillars_items_order_idx" ON "_pages_v_blocks_cl_pillars_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_pillars_items_parent_id_idx" ON "_pages_v_blocks_cl_pillars_items" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_pillars_order_idx" ON "_pages_v_blocks_cl_pillars" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_pillars_parent_id_idx" ON "_pages_v_blocks_cl_pillars" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_pillars_path_idx" ON "_pages_v_blocks_cl_pillars" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_sauna_benefits_items_order_idx" ON "_pages_v_blocks_cl_sauna_benefits_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_sauna_benefits_items_parent_id_idx" ON "_pages_v_blocks_cl_sauna_benefits_items" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_sauna_benefits_order_idx" ON "_pages_v_blocks_cl_sauna_benefits" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_sauna_benefits_parent_id_idx" ON "_pages_v_blocks_cl_sauna_benefits" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_cl_sauna_benefits_path_idx" ON "_pages_v_blocks_cl_sauna_benefits" USING btree ("_path");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "pages_blocks_cl_find_sanctuary" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_cl_mission" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_cl_pillars_items" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_cl_pillars" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_cl_sauna_benefits_items" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_cl_sauna_benefits" CASCADE;
    DROP TABLE IF EXISTS "_pages_v_blocks_cl_find_sanctuary" CASCADE;
    DROP TABLE IF EXISTS "_pages_v_blocks_cl_mission" CASCADE;
    DROP TABLE IF EXISTS "_pages_v_blocks_cl_pillars_items" CASCADE;
    DROP TABLE IF EXISTS "_pages_v_blocks_cl_pillars" CASCADE;
    DROP TABLE IF EXISTS "_pages_v_blocks_cl_sauna_benefits_items" CASCADE;
    DROP TABLE IF EXISTS "_pages_v_blocks_cl_sauna_benefits" CASCADE;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_cl_hero_loc" DROP COLUMN IF EXISTS "intro_tagline";
    EXCEPTION WHEN undefined_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_cl_hero_loc" DROP COLUMN IF EXISTS "intro_tagline";
    EXCEPTION WHEN undefined_column THEN NULL;
    END $$;
  `)

  // Enum values cannot be removed safely in Postgres; leave enum_tenants_allowed_blocks extended.
}
