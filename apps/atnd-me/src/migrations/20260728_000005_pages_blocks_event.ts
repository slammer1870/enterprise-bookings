import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the `event` pages block (timeslot-backed event landing).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_event" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "timeslot_id" integer,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_event" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "timeslot_id" integer,
      "_uuid" varchar,
      "block_name" varchar
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_event"
        ADD CONSTRAINT "pages_blocks_event_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_event"
        ADD CONSTRAINT "_pages_v_blocks_event_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pages_blocks_event"
        ADD CONSTRAINT "pages_blocks_event_timeslot_id_timeslots_id_fk"
        FOREIGN KEY ("timeslot_id") REFERENCES "public"."timeslots"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_event"
        ADD CONSTRAINT "_pages_v_blocks_event_timeslot_id_timeslots_id_fk"
        FOREIGN KEY ("timeslot_id") REFERENCES "public"."timeslots"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "pages_blocks_event_order_idx"
      ON "pages_blocks_event" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_event_parent_id_idx"
      ON "pages_blocks_event" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_event_path_idx"
      ON "pages_blocks_event" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_event_timeslot_idx"
      ON "pages_blocks_event" USING btree ("timeslot_id");

    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_event_order_idx"
      ON "_pages_v_blocks_event" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_event_parent_id_idx"
      ON "_pages_v_blocks_event" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_event_path_idx"
      ON "_pages_v_blocks_event" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_event_timeslot_idx"
      ON "_pages_v_blocks_event" USING btree ("timeslot_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "_pages_v_blocks_event" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_event" CASCADE;
  `)
}
