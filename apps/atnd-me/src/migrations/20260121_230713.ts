import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "users_role" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_role",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-01-21T23:07:13.011Z';
  ALTER TABLE "users_role" ADD CONSTRAINT "users_role_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_role_order_idx" ON "users_role" USING btree ("order");
  CREATE INDEX "users_role_parent_idx" ON "users_role" USING btree ("parent_id");
  CREATE INDEX "accounts_access_token_expires_at_idx" ON "accounts" USING btree ("access_token_expires_at");
  CREATE INDEX "accounts_refresh_token_expires_at_idx" ON "accounts" USING btree ("refresh_token_expires_at");
  CREATE INDEX "verifications_expires_at_idx" ON "verifications" USING btree ("expires_at");
  ALTER TABLE "users" DROP COLUMN "role";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_role" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "users_role" CASCADE;
  DROP INDEX "accounts_access_token_expires_at_idx";
  DROP INDEX "accounts_refresh_token_expires_at_idx";
  DROP INDEX "verifications_expires_at_idx";
  ALTER TABLE "users" ALTER COLUMN "name" DROP NOT NULL;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-01-21T17:35:02.953Z';
  ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'user' NOT NULL;`)
}
