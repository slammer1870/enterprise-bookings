import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Alias hosts are stored with the other hasMany text values on tenants.
 * Payload keeps those rows in tenants_texts (path = aliasHosts).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "tenants_texts" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "text" varchar
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "tenants_texts"
        ADD CONSTRAINT "tenants_texts_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."tenants"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "tenants_texts_order_parent"
      ON "tenants_texts" USING btree ("order", "parent_id");
    CREATE INDEX IF NOT EXISTS "tenants_texts_text_idx"
      ON "tenants_texts" USING btree ("text");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "tenants_texts" CASCADE;
  `)
}
