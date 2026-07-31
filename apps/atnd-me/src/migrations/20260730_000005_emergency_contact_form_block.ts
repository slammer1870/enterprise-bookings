import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the `emergencyContactForm` pages block.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_emergency_contact_form" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "heading" varchar DEFAULT 'Emergency contacts',
      "intro" jsonb,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_emergency_contact_form" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "heading" varchar DEFAULT 'Emergency contacts',
      "intro" jsonb,
      "_uuid" varchar,
      "block_name" varchar
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_emergency_contact_form"
        ADD CONSTRAINT "pages_blocks_emergency_contact_form_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_emergency_contact_form"
        ADD CONSTRAINT "_pages_v_blocks_emergency_contact_form_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "pages_blocks_emergency_contact_form_order_idx"
      ON "pages_blocks_emergency_contact_form" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_emergency_contact_form_parent_id_idx"
      ON "pages_blocks_emergency_contact_form" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_emergency_contact_form_path_idx"
      ON "pages_blocks_emergency_contact_form" USING btree ("_path");

    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_emergency_contact_form_order_idx"
      ON "_pages_v_blocks_emergency_contact_form" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_emergency_contact_form_parent_id_idx"
      ON "_pages_v_blocks_emergency_contact_form" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_emergency_contact_form_path_idx"
      ON "_pages_v_blocks_emergency_contact_form" USING btree ("_path");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "_pages_v_blocks_emergency_contact_form" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_emergency_contact_form" CASCADE;
  `)
}
