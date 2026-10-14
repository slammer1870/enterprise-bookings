#!/usr/bin/env tsx
/**
 * Flips Bru Grappling's canonical host to brugrappling.ie.
 *
 * Refuses to write until both cutover gates are passed on the command line:
 *   --apex-cname-live
 *   --homepage-rule-removed
 *
 * See scripts/bru-public-host-cutover.md.
 *
 *   pnpm exec tsx scripts/cutover-bru-public-host.ts --apex-cname-live --homepage-rule-removed
 */
import 'dotenv/config'
import {
  bruCutoverConfirmed,
  isBruGrapplingTenant,
  publicHostRowsToWrite,
} from '../src/utilities/migrateTenantPublicHosts'
import {
  readLegacyTenantPublicHostRows,
  writePublicHostDeclarations,
} from '../src/migrations/20261013_000001_migrate_tenant_public_hosts'

async function main() {
  if (!bruCutoverConfirmed(process.argv)) {
    console.error(
      'Refusing to flip Bru Grappling. Pass --apex-cname-live and --homepage-rule-removed after both are done. See scripts/bru-public-host-cutover.md.',
    )
    process.exit(1)
  }

  if (!process.env.DATABASE_URI?.trim()) {
    console.error('DATABASE_URI is required.')
    process.exit(1)
  }

  const { getPayload } = await import('../src/lib/payload')
  const payload = await getPayload()
  const db = payload.db.drizzle
  if (!db) {
    console.error('Postgres adapter is not ready.')
    process.exit(1)
  }

  const rows = await readLegacyTenantPublicHostRows(db)
  const bru = rows.filter((row) => isBruGrapplingTenant(row))
  if (bru.length === 0) {
    console.error('No tenant with slug brugrappling.')
    process.exit(1)
  }

  const writes = publicHostRowsToWrite(bru, { bruCutover: true })
  await db.transaction(async (tx) => {
    await writePublicHostDeclarations(tx, writes)
  })
  for (const write of writes) {
    console.log(
      `brugrappling canonical host ${write.canonicalHost}; alias hosts ${write.aliasHosts.join(', ')}; platform subdomain ${write.platformSubdomain} is an ${write.platformSubdomainRole}.`,
    )
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
