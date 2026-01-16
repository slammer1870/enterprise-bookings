import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

/**
 * Migration to fix schema mismatch in production database
 * 
 * This migration fixes the case where the production database has columns from
 * kyuzo's schema (heading, subheading, brand_name) instead of bru-grappling's
 * schema (title, subtitle, company_name).
 * 
 * It:
 * 1. Migrates data from old columns to new columns in pages_blocks_hero
 * 2. Migrates data from old columns to new columns in footer
 * 3. Drops the old columns
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  try {
    // Check if pages_blocks_hero table exists
    const heroTableExists = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'pages_blocks_hero'
      ) as exists
    `);

    if (heroTableExists.rows?.[0]?.exists) {
      // Check if new columns exist (bru-grappling schema)
      const hasNewColumns = await db.execute<{ exists: boolean }>(sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'pages_blocks_hero' 
          AND column_name = 'title'
          AND table_schema = 'public'
        ) as exists
      `);

      // Check if old columns exist (from kyuzo schema)
      const hasOldColumns = await db.execute<{ exists: boolean }>(sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'pages_blocks_hero' 
          AND column_name = 'heading'
          AND table_schema = 'public'
        ) as exists
      `);

      if (!hasNewColumns.rows?.[0]?.exists) {
        console.log("Missing required columns in pages_blocks_hero, adding them...");

        // Add new columns first
        await db.execute(sql`
          ALTER TABLE "pages_blocks_hero"
          ADD COLUMN IF NOT EXISTS "title" varchar,
          ADD COLUMN IF NOT EXISTS "subtitle" varchar,
          ADD COLUMN IF NOT EXISTS "description" varchar,
          ADD COLUMN IF NOT EXISTS "primary_button_text" varchar,
          ADD COLUMN IF NOT EXISTS "primary_button_link" varchar,
          ADD COLUMN IF NOT EXISTS "secondary_button_text" varchar,
          ADD COLUMN IF NOT EXISTS "secondary_button_link" varchar,
          ADD COLUMN IF NOT EXISTS "logo_id" integer
        `);

        // If old columns exist, migrate data from them
        if (hasOldColumns.rows?.[0]?.exists) {
          console.log("Found old schema columns, migrating data...");
          await db.execute(sql`
            UPDATE "pages_blocks_hero"
            SET 
              "title" = COALESCE("heading", ''),
              "subtitle" = COALESCE("subheading", ''),
              "description" = '',
              "primary_button_text" = COALESCE("cta1_text", ''),
              "primary_button_link" = COALESCE("cta1_link", ''),
              "secondary_button_text" = COALESCE("cta2_text", ''),
              "secondary_button_link" = COALESCE("cta2_link", '')
            WHERE "heading" IS NOT NULL OR "subheading" IS NOT NULL
          `);

          // Drop old columns after migration
          console.log("Dropping old columns from pages_blocks_hero...");
          await db.execute(sql`
            ALTER TABLE "pages_blocks_hero"
            DROP COLUMN IF EXISTS "heading",
            DROP COLUMN IF EXISTS "subheading",
            DROP COLUMN IF EXISTS "cta1_text",
            DROP COLUMN IF EXISTS "cta1_link",
            DROP COLUMN IF EXISTS "cta2_text",
            DROP COLUMN IF EXISTS "cta2_link",
            DROP COLUMN IF EXISTS "form_title",
            DROP COLUMN IF EXISTS "form_description",
            DROP COLUMN IF EXISTS "form_id"
          `);
        }

        // Set default values for any NULL values before making columns NOT NULL
        await db.execute(sql`
          UPDATE "pages_blocks_hero"
          SET 
            "title" = COALESCE("title", ''),
            "subtitle" = COALESCE("subtitle", ''),
            "description" = COALESCE("description", ''),
            "primary_button_text" = COALESCE("primary_button_text", ''),
            "primary_button_link" = COALESCE("primary_button_link", '')
          WHERE "title" IS NULL OR "subtitle" IS NULL OR "description" IS NULL 
            OR "primary_button_text" IS NULL OR "primary_button_link" IS NULL
        `);

        // Make new columns NOT NULL (only if they don't already have the constraint)
        try {
          await db.execute(sql`
            ALTER TABLE "pages_blocks_hero"
            ALTER COLUMN "title" SET NOT NULL,
            ALTER COLUMN "subtitle" SET NOT NULL,
            ALTER COLUMN "description" SET NOT NULL,
            ALTER COLUMN "primary_button_text" SET NOT NULL,
            ALTER COLUMN "primary_button_link" SET NOT NULL
          `);
        } catch (error) {
          // Columns might already be NOT NULL, which is fine
          console.log("Some columns may already have NOT NULL constraint");
        }
      }
    }

    // Check if footer table exists
    const footerTableExists = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'footer'
      ) as exists
    `);

    if (footerTableExists.rows?.[0]?.exists) {
      // Check if new column exists (bru-grappling schema)
      const hasNewColumn = await db.execute<{ exists: boolean }>(sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'footer' 
          AND column_name = 'company_name'
          AND table_schema = 'public'
        ) as exists
      `);

      // Check if old column exists (from kyuzo schema)
      const hasOldColumn = await db.execute<{ exists: boolean }>(sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'footer' 
          AND column_name = 'brand_name'
          AND table_schema = 'public'
        ) as exists
      `);

      if (!hasNewColumn.rows?.[0]?.exists) {
        console.log("Missing required column in footer, adding it...");

        // Add new column first
        await db.execute(sql`
          ALTER TABLE "footer"
          ADD COLUMN IF NOT EXISTS "company_name" varchar,
          ADD COLUMN IF NOT EXISTS "logo_id" integer,
          ADD COLUMN IF NOT EXISTS "email" varchar,
          ADD COLUMN IF NOT EXISTS "location_url" varchar,
          ADD COLUMN IF NOT EXISTS "instagram_url" varchar
        `);

        // If old column exists, migrate data from it
        if (hasOldColumn.rows?.[0]?.exists) {
          console.log("Found old schema column, migrating data...");
          await db.execute(sql`
            UPDATE "footer"
            SET "company_name" = COALESCE("brand_name", 'Brú Grappling Studio')
            WHERE "brand_name" IS NOT NULL
          `);

          // Drop old columns after migration
          console.log("Dropping old columns from footer...");
          await db.execute(sql`
            ALTER TABLE "footer"
            DROP COLUMN IF EXISTS "brand_name",
            DROP COLUMN IF EXISTS "copyright_text",
            DROP COLUMN IF EXISTS "social_links_facebook",
            DROP COLUMN IF EXISTS "social_links_twitter",
            DROP COLUMN IF EXISTS "social_links_instagram",
            DROP COLUMN IF EXISTS "social_links_youtube"
          `);
        } else {
          // Set default values if no old data exists
          await db.execute(sql`
            UPDATE "footer"
            SET "company_name" = COALESCE("company_name", 'Brú Grappling Studio'),
                "email" = COALESCE("email", 'info@brugrappling.ie'),
                "location_url" = COALESCE("location_url", 'https://goo.gl/maps/aqepRdNh9YcYNGuEA'),
                "instagram_url" = COALESCE("instagram_url", 'https://www.instagram.com/bru_grappling/')
            WHERE "company_name" IS NULL OR "email" IS NULL OR "location_url" IS NULL OR "instagram_url" IS NULL
          `);
        }

        // Make new columns NOT NULL (only if they don't already have the constraint)
        try {
          await db.execute(sql`
            ALTER TABLE "footer"
            ALTER COLUMN "company_name" SET NOT NULL,
            ALTER COLUMN "email" SET NOT NULL,
            ALTER COLUMN "location_url" SET NOT NULL,
            ALTER COLUMN "instagram_url" SET NOT NULL
          `);
          // Note: logo_id might be NULL initially, so we don't set it to NOT NULL here
          // It should be handled by the schema definition
        } catch (error) {
          // Columns might already have NOT NULL constraint, which is fine
          console.log("Some columns may already have NOT NULL constraint");
        }
      }
    }

    console.log("Schema migration completed successfully");
  } catch (error) {
    console.error("Error during schema migration:", error);
    throw error;
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Reverse migration: restore old columns (not recommended, but included for completeness)
  try {
    // This is a destructive migration, so the down migration is intentionally minimal
    // In practice, you wouldn't want to revert this as it would break the application
    console.log("Down migration for schema fix - this would restore old columns");
    console.log("Warning: This is not recommended as it would break the application");
  } catch (error) {
    console.error("Error during migration rollback:", error);
    throw error;
  }
}
