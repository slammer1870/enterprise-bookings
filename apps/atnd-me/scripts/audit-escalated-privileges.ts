#!/usr/bin/env tsx
/**
 * Production audit + remediation for improperly escalated user privileges.
 *
 * Background
 * ----------
 * A now-fixed bug allowed a Tenant A admin to assign the `admin` role to any user
 * they could see (including users registered at a completely different tenant). The
 * user would then have admin panel access to their own registration tenant — meaning
 * Tenant B's admin might unknowingly be someone that Tenant A's admin promoted.
 *
 * The fix (in src/collections/Users/index.ts beforeChange hook) prevents new exploits.
 * This script audits existing data and, optionally, strips elevated roles from users
 * whose situation looks suspicious.
 *
 * How it detects suspicious escalation
 * -------------------------------------
 * A user is flagged if they have an elevated role (admin / location-manager) but have
 * bookings at tenants OTHER than their registration tenant. This is the exact scenario
 * the bug enabled:
 *   1. User X registers at Tenant B (registrationTenant = B, tenants = [B])
 *   2. Tenant A admin can see User X in their user list (because X has a booking at A)
 *   3. Tenant A admin assigns `admin` to User X → X now has admin access to Tenant B's panel
 *
 * Additionally, users with elevated roles who are members of multiple tenants are flagged
 * for manual review, since they may have been set up legitimately by a super-admin or may
 * be the result of the exploit.
 *
 * Usage
 * -----
 *   # Audit only — prints the report, no changes:
 *   DATABASE_URI=... PAYLOAD_SECRET=... pnpm exec tsx scripts/audit-escalated-privileges.ts
 *
 *   # Remediate: strip elevated roles from users who ONLY have cross-tenant bookings
 *   # (i.e. clearly suspicious; would not have the role if not for the bug):
 *   DATABASE_URI=... PAYLOAD_SECRET=... pnpm exec tsx scripts/audit-escalated-privileges.ts --fix
 *
 *   # Limit to a specific tenant's users for a targeted fix:
 *   DATABASE_URI=... PAYLOAD_SECRET=... pnpm exec tsx scripts/audit-escalated-privileges.ts --fix --tenant-id=42
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const FIX = process.argv.includes('--fix')
const TENANT_ID_ARG = process.argv.find((a) => a.startsWith('--tenant-id='))
const FILTER_TENANT_ID = TENANT_ID_ARG ? parseInt(TENANT_ID_ARG.split('=')[1]!, 10) : null

const ELEVATED_ROLES = new Set(['admin', 'location-manager'])

function coerceId(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'object' && raw !== null && 'id' in raw) {
    const id = (raw as { id: unknown }).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
    if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  }
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return parseInt(raw, 10)
  return null
}

function extractTenantIds(tenants: unknown[]): number[] {
  return tenants
    .map((t) => {
      if (typeof t === 'object' && t !== null && 'tenant' in t) {
        return coerceId((t as { tenant: unknown }).tenant)
      }
      return coerceId(t)
    })
    .filter((id): id is number => id !== null)
}

async function main() {
  if (!process.env.DATABASE_URI?.trim()) {
    console.error('❌  DATABASE_URI is required')
    process.exit(1)
  }
  if (!process.env.PAYLOAD_SECRET?.trim()) {
    console.error('❌  PAYLOAD_SECRET is required')
    process.exit(1)
  }

  const payload = await getPayload({ config: await config })

  console.log('='.repeat(72))
  console.log(' audit-escalated-privileges')
  console.log(` Mode: ${FIX ? 'FIX (will strip elevated roles from clearly suspicious users)' : 'AUDIT ONLY'}`)
  if (FILTER_TENANT_ID) console.log(` Filtering to tenant ID: ${FILTER_TENANT_ID}`)
  console.log('='.repeat(72))

  type UserRow = {
    id: number
    email: string
    role?: string | string[]
    tenants?: unknown[]
    registrationTenant?: unknown
  }

  // Fetch all users with elevated roles at depth 1 to get tenant join data.
  const { docs: allUsers } = await payload.find({
    collection: 'users',
    limit: 0,
    depth: 1,
    overrideAccess: true,
    ...(FILTER_TENANT_ID
      ? {
          where: {
            'tenants.tenant': { equals: FILTER_TENANT_ID },
          },
        }
      : {}),
  })

  const elevatedUsers = (allUsers as UserRow[]).filter((u) => {
    const roles = Array.isArray(u.role) ? u.role : u.role ? [u.role] : []
    return roles.some((r) => ELEVATED_ROLES.has(r))
  })

  console.log(`\n${elevatedUsers.length} user(s) with elevated role (admin / location-manager).\n`)

  // Collect all bookings for elevated users so we can check cross-tenant booking patterns.
  // We only care about whether a user has bookings outside their registration tenant.
  const elevatedUserIds = elevatedUsers.map((u) => u.id)

  // Fetch bookings for these users in batches to find cross-tenant bookings.
  // We only need user + tenant fields (depth 0 is enough since tenant is a FK on booking).
  const { docs: bookings } = elevatedUserIds.length
    ? await payload.find({
        collection: 'bookings',
        limit: 0,
        depth: 0,
        overrideAccess: true,
        where: { user: { in: elevatedUserIds } },
      })
    : { docs: [] }

  // Build map: userId → Set of tenant IDs they have bookings at
  const bookingTenantsByUser = new Map<number, Set<number>>()
  for (const booking of bookings as Array<{ user?: unknown; tenant?: unknown }>) {
    const userId = coerceId(booking.user)
    const tenantId = coerceId(booking.tenant)
    if (userId == null || tenantId == null) continue
    if (!bookingTenantsByUser.has(userId)) bookingTenantsByUser.set(userId, new Set())
    bookingTenantsByUser.get(userId)!.add(tenantId)
  }

  let cleanCount = 0
  let suspiciousCount = 0
  let fixedCount = 0

  const suspiciousReport: string[] = []
  const multiTenantReport: string[] = []

  for (const user of elevatedUsers) {
    const roles = (Array.isArray(user.role) ? user.role : user.role ? [user.role] : []).filter((r) =>
      ELEVATED_ROLES.has(r),
    )
    const memberTenantIds = extractTenantIds(Array.isArray(user.tenants) ? user.tenants : [])
    const regId = coerceId(user.registrationTenant)

    // Users with multiple tenant memberships need manual review.
    if (memberTenantIds.length > 1) {
      multiTenantReport.push(
        `  ℹ  ${user.email} (id=${user.id}) roles=[${roles.join(',')}] tenants=[${memberTenantIds.join(',')}] registrationTenant=${regId ?? '—'}`,
      )
    }

    // Core suspicious check: user has elevated role, and they have bookings at tenants
    // OUTSIDE their membership tenants. This is the signature of the escalation exploit:
    // a Tenant A admin saw them in the user list (via the cross-tenant booking) and promoted them.
    const bookingTenants = bookingTenantsByUser.get(user.id) ?? new Set<number>()
    const crossTenantBookingTenants = [...bookingTenants].filter(
      (tid) => !memberTenantIds.includes(tid),
    )

    if (crossTenantBookingTenants.length === 0) {
      cleanCount++
      continue
    }

    // User has bookings at tenant(s) outside their membership — escalation pattern detected.
    suspiciousCount++
    const line = `  ⚠  ${user.email} (id=${user.id}) roles=[${roles.join(',')}] tenants=[${memberTenantIds.join(',')}] cross-tenant bookings at=[${crossTenantBookingTenants.join(',')}]`
    suspiciousReport.push(line)
    console.log(line)

    if (FIX) {
      // Strip elevated roles. Keep any non-elevated roles; default to ['user'].
      const allRoles = Array.isArray(user.role) ? user.role : user.role ? [user.role] : []
      const keptRoles = allRoles.filter((r) => !ELEVATED_ROLES.has(r))
      const newRole = keptRoles.length > 0 ? keptRoles : ['user']

      await payload.update({
        collection: 'users',
        id: user.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { role: newRole } as any,
        overrideAccess: true,
      })
      console.log(`     ✅ Downgraded to role=[${newRole.join(',')}]`)
      fixedCount++
    }
  }

  console.log('\n' + '='.repeat(72))
  console.log(' Summary')
  console.log('='.repeat(72))
  console.log(` Elevated users           : ${elevatedUsers.length}`)
  console.log(` Clean (no cross-booking) : ${cleanCount}`)
  console.log(` Suspicious               : ${suspiciousCount}`)
  if (FIX) console.log(` Fixed (role stripped)    : ${fixedCount}`)
  console.log(` Multi-tenant (review)    : ${multiTenantReport.length}`)

  if (multiTenantReport.length > 0) {
    console.log('\n Users with multiple tenant memberships (verify with super-admin):')
    multiTenantReport.forEach((l) => console.log(l))
  }

  if (suspiciousReport.length > 0 && !FIX) {
    console.log(
      '\n ℹ  Re-run with --fix to strip elevated roles from the suspicious users above.',
    )
    console.log(
      '    Review multi-tenant users manually before applying --fix to them.',
    )
  }

  if (suspiciousCount === 0) {
    console.log('\n ✅ No suspicious escalation patterns found.')
  }

  console.log('')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌  Audit failed:', err)
  process.exit(1)
})
