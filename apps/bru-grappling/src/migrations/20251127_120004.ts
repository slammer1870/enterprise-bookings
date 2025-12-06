import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_users_roles" AS ENUM('customer', 'admin');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS "users_roles" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum_users_roles",
      "id" serial PRIMARY KEY NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "users_roles"
      ADD CONSTRAINT "users_roles_parent_fk"
      FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "users_roles_order_idx" ON "users_roles" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "users_roles_parent_idx" ON "users_roles" USING btree ("parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "users_roles_order_idx";
    DROP INDEX IF EXISTS "users_roles_parent_idx";
    DROP TABLE IF EXISTS "users_roles" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_users_roles";
  `)
}

