import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Phase 7 Chunk 5 — `location-manager` role + `users.locations` (Drizzle uses `users_rels` + `locations_id`).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "public"."enum_users_role" ADD VALUE 'location-manager';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS "users_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "locations_id" integer
    );

    DO $$ BEGIN
      ALTER TABLE "users_rels"
        ADD CONSTRAINT "users_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id")
        ON DELETE cascade
        ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "users_rels"
        ADD CONSTRAINT "users_rels_locations_fk"
        FOREIGN KEY ("locations_id") REFERENCES "public"."locations"("id")
        ON DELETE cascade
        ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "users_rels_order_idx"
      ON "users_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "users_rels_parent_idx"
      ON "users_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "users_rels_path_idx"
      ON "users_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "users_rels_locations_id_idx"
      ON "users_rels" USING btree ("locations_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "users_rels" CASCADE;
    DROP TABLE IF EXISTS "users_locations" CASCADE;
  `)
}
