import { sql } from '@payloadcms/db-postgres'
import { rowsOf } from '@/utilities/drizzleRows'
import { getPayloadInstance } from './data-helpers'

/**
 * `nip.io` and `sslip.io` are not public suffixes, so every host under one of
 * them claims that whole name. Only one tenant can hold a given name. Clear it
 * before the next scenario creates a host there.
 */
const APEX_LIKE = {
  'nip.io': '%nip.io%',
  'sslip.io': '%sslip.io%',
} as const

export type SharedLoopbackApex = keyof typeof APEX_LIKE

export async function releaseClaimedApex(apex: SharedLoopbackApex): Promise<void> {
  const payload = await getPayloadInstance()
  const drizzle = payload.db?.drizzle
  if (!drizzle) return
  const result = await drizzle.execute(
    sql`SELECT "id" FROM "tenants" WHERE "hostnames"::text LIKE ${APEX_LIKE[apex]}`,
  )
  for (const row of rowsOf(result)) {
    if (row.id == null) continue
    await payload.update({
      collection: 'tenants',
      id: row.id as number,
      data: { hostnames: [], direction: 'allow-www-and-non-www' },
      overrideAccess: true,
    })
  }
}
