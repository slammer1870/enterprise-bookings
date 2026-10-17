import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import { rowsOf } from '@/utilities/drizzleRows'
import {
  legacyTenantPublicHostRows,
  publicHostRowsToWrite,
  type HostnameListWrite,
  type LegacyTenantPublicHostRow,
} from '@/utilities/migrateTenantPublicHosts'

type PublicHostDb = MigrateUpArgs['db']

export async function readLegacyTenantPublicHostRows(
  db: PublicHostDb,
): Promise<LegacyTenantPublicHostRow[]> {
  const tenants = await db.execute(sql`
    SELECT "id", "slug", "domain", "redirect_apex" AS "redirectApex", "apex_domain" AS "apexDomain"
    FROM "tenants"
  `)
  const aliases = await db.execute(sql`
    SELECT "parent_id" AS "parentId", "text"
    FROM "tenants_texts"
    WHERE "path" = 'aliasHosts'
    ORDER BY "parent_id", "order"
  `)

  const aliasHostsByParent = new Map<string, string[]>()
  for (const row of rowsOf(aliases)) {
    if (typeof row.text !== 'string' || row.parentId == null) continue
    const parentId = String(row.parentId)
    const hosts = aliasHostsByParent.get(parentId) ?? []
    hosts.push(row.text)
    aliasHostsByParent.set(parentId, hosts)
  }

  return legacyTenantPublicHostRows(rowsOf(tenants)).map((row) => ({
    ...row,
    aliasHosts: aliasHostsByParent.get(String(row.id)) ?? [],
  }))
}

/**
 * Writes the hostname list and Direction. Leaves domain, alias hosts, Redirect apex,
 * and the stored parent in place. Does not run save hooks, so it does not wait on DNS
 * or a certificate.
 */
export async function writeHostnameLists(
  db: PublicHostDb,
  writes: HostnameListWrite[],
): Promise<void> {
  for (const write of writes) {
    await db.execute(sql`
      UPDATE "tenants"
      SET "hostnames" = ${JSON.stringify(write.hostnames)}::jsonb,
          "direction" = ${write.direction}::"public"."enum_tenants_direction"
      WHERE "id" = ${write.id}
    `)
  }
}

/**
 * Each stored row becomes an ordered hostname list and one Direction.
 * Bru Grappling is included. Its apex CNAME and homepage rule stay an operator checklist.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const rows = await readLegacyTenantPublicHostRows(db)
  await writeHostnameLists(db, publicHostRowsToWrite(rows))
}

/** One-way. The hostname list is not turned back into the legacy fields. */
export async function down(_args: MigrateDownArgs): Promise<void> {}
