import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Drop obsolete drop_ins_payment_methods table.
 * Drop-ins always use card payments; the field was redundant admin UI.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "drop_ins_payment_methods" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_drop_ins_payment_methods";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_drop_ins_payment_methods" AS ENUM('card');
    CREATE TABLE "drop_ins_payment_methods" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum_drop_ins_payment_methods",
      "id" serial PRIMARY KEY NOT NULL
    );
    ALTER TABLE "drop_ins_payment_methods" ADD CONSTRAINT "drop_ins_payment_methods_parent_fk"
      FOREIGN KEY ("parent_id") REFERENCES "public"."drop_ins"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "drop_ins_payment_methods_order_idx" ON "drop_ins_payment_methods" USING btree ("order");
    CREATE INDEX "drop_ins_payment_methods_parent_idx" ON "drop_ins_payment_methods" USING btree ("parent_id");
    INSERT INTO "drop_ins_payment_methods" ("order", "parent_id", "value")
    SELECT 1, "id", 'card'::"enum_drop_ins_payment_methods" FROM "drop_ins";
  `)
}
