import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Replaces the plain `url` varchar on pages_blocks_hw_hero_services_services
 * with the standard CMS link group columns (link_type enum, link_new_tab, link_url).
 *
 * The polymorphic `reference` relationship is stored in _rels and requires no column.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pages_blocks_hw_hero_services_services_link_type" AS ENUM('reference', 'custom');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum__pages_v_blocks_hw_hero_services_services_link_type" AS ENUM('reference', 'custom');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_hw_hero_services_services" DROP COLUMN "url";
    EXCEPTION WHEN undefined_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_hw_hero_services_services"
        ADD COLUMN "link_type" "public"."enum_pages_blocks_hw_hero_services_services_link_type" DEFAULT 'reference';
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_hw_hero_services_services"
        ADD COLUMN "link_new_tab" boolean;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_hw_hero_services_services"
        ADD COLUMN "link_url" varchar;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_hw_hero_services_services" DROP COLUMN "url";
    EXCEPTION WHEN undefined_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_hw_hero_services_services"
        ADD COLUMN "link_type" "public"."enum__pages_v_blocks_hw_hero_services_services_link_type" DEFAULT 'reference';
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_hw_hero_services_services"
        ADD COLUMN "link_new_tab" boolean;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_hw_hero_services_services"
        ADD COLUMN "link_url" varchar;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_hw_hero_services_services" DROP COLUMN IF EXISTS "link_type";
    EXCEPTION WHEN undefined_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_hw_hero_services_services" DROP COLUMN IF EXISTS "link_new_tab";
    EXCEPTION WHEN undefined_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_hw_hero_services_services" DROP COLUMN IF EXISTS "link_url";
    EXCEPTION WHEN undefined_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_hw_hero_services_services"
        ADD COLUMN "url" varchar;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_hw_hero_services_services" DROP COLUMN IF EXISTS "link_type";
    EXCEPTION WHEN undefined_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_hw_hero_services_services" DROP COLUMN IF EXISTS "link_new_tab";
    EXCEPTION WHEN undefined_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_hw_hero_services_services" DROP COLUMN IF EXISTS "link_url";
    EXCEPTION WHEN undefined_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_hw_hero_services_services"
        ADD COLUMN "url" varchar;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;

    DROP TYPE IF EXISTS "public"."enum_pages_blocks_hw_hero_services_services_link_type";
    DROP TYPE IF EXISTS "public"."enum__pages_v_blocks_hw_hero_services_services_link_type";
  `)
}
