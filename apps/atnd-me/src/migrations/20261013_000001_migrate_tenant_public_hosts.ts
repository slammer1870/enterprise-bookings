import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import {
  legacyTenantPublicHostRows,
  publicHostRowsToWrite,
  type LegacyTenantPublicHostRow,
  type PublicHostWrite,
} from '@/utilities/migrateTenantPublicHosts'

type PublicHostDb = MigrateUpArgs['db']

export async function readLegacyTenantPublicHostRows(
  db: PublicHostDb,
): Promise<LegacyTenantPublicHostRow[]> {
  const { rows } = await db.execute(sql`
    SELECT "id", "slug", "domain", "redirect_apex" AS "redirectApex"
    FROM "tenants"
  `)
  return legacyTenantPublicHostRows(rows)
}

/** Writes canonical host (`tenants.domain`) and alias hosts (`tenants_texts`). Does not run save hooks. */
export async function writePublicHostDeclarations(
  db: PublicHostDb,
  writes: PublicHostWrite[],
): Promise<void> {
  for (const write of writes) {
    await db.execute(sql`
      UPDATE "tenants"
      SET "domain" = ${write.canonicalHost}
      WHERE "id" = ${write.id}
    `)
    await db.execute(sql`
      DELETE FROM "tenants_texts"
      WHERE "parent_id" = ${write.id} AND "path" = 'aliasHosts'
    `)
    for (const [index, host] of write.aliasHosts.entries()) {
      await db.execute(sql`
        INSERT INTO "tenants_texts" ("order", "parent_id", "path", "text")
        VALUES (${index + 1}, ${write.id}, 'aliasHosts', ${host})
      `)
    }
  }
}

/**
 * Maps stored `domain` / `redirect_apex` onto the canonical host and alias list.
 * Bru Grappling is left unchanged; its direction flip is the cutover script.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const rows = await readLegacyTenantPublicHostRows(db)
  await writePublicHostDeclarations(db, publicHostRowsToWrite(rows, { bruCutover: false }))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const rows = await readLegacyTenantPublicHostRows(db)
  const writes = publicHostRowsToWrite(rows, { bruCutover: false })
  for (const write of writes) {
    for (const host of write.aliasHosts) {
      await db.execute(sql`
        DELETE FROM "tenants_texts"
        WHERE "parent_id" = ${write.id}
          AND "path" = 'aliasHosts'
          AND "text" = ${host}
      `)
    }
  }
}
