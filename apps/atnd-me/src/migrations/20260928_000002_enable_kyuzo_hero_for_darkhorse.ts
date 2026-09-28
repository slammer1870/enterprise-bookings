import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** Enables the Kyuzo hero block for the Dark Horse tenant. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    INSERT INTO "tenants_allowed_blocks" ("order", "parent_id", "value")
    SELECT
      COALESCE(
        (SELECT MAX(existing_order."order")
         FROM "tenants_allowed_blocks" existing_order
         WHERE existing_order."parent_id" = "tenants"."id"),
        -1
      ) + 1,
      "id",
      'kyuzoHero'
    FROM "tenants"
    WHERE "slug" = 'darkhorse-strength'
      AND NOT EXISTS (
        SELECT 1
        FROM "tenants_allowed_blocks" existing
        WHERE existing."parent_id" = "tenants"."id"
          AND existing."value" = 'kyuzoHero'
      )
    GROUP BY "id";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DELETE FROM "tenants_allowed_blocks"
    WHERE "value" = 'kyuzoHero'
      AND "parent_id" IN (SELECT "id" FROM "tenants" WHERE "slug" = 'darkhorse-strength');
  `)
}
