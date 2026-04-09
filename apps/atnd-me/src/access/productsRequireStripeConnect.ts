/**
 * Access control for Products and Billing collections.
 * Products: drop-ins, class-pass-types, plans.
 * Billing: class-passes, transactions, subscriptions.
 * - Admin: full access to all.
 * - Tenant-admin: can only see and manage when Stripe Connect is connected
 *   for that tenant (stripeConnectOnboardingStatus === 'active'). If none of
 *   their tenants have Connect connected, the Products/Billing sections are
 *   hidden (admin access returns false).
 */
import type { Access, AccessArgs } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { getUserTenantIds } from './tenant-scoped'
import { isAdmin, isTenantAdmin } from './userTenantAccess'

type TenantDoc = {
  id: number
  stripeConnectAccountId?: string | null
  stripeConnectOnboardingStatus?: string | null
}

/**
 * Returns tenant IDs that have Stripe Connect connected (active).
 * - Admin: returns null (meaning "all tenants" / no filter).
 * - Tenant-admin: returns array of their tenant IDs that have Connect active, or [] if none.
 * - Other users / unauthenticated: returns [] (no product access for this policy).
 */
async function getConnectedTenantIds(args: AccessArgs): Promise<number[] | null> {
  const { req } = args
  const user = req.user

  if (user && checkRole(['super-admin'], user as unknown as SharedUser)) {
    return null
  }

  // Staff do not manage Stripe products or billing collections.
  if (user && checkRole(['staff'], user as unknown as SharedUser) && !checkRole(['admin'], user as unknown as SharedUser)) {
    return []
  }

  if (!user || !checkRole(['admin'], user as unknown as SharedUser)) {
    return []
  }

  const tenantIds = getUserTenantIds(user as unknown as SharedUser)
  if (tenantIds === null || tenantIds.length === 0) return []

  const tenants = await req.payload.find({
    collection: 'tenants',
    where: { id: { in: tenantIds } },
    depth: 0,
    limit: 500,
    overrideAccess: true,
  })

  const connected = (tenants.docs as TenantDoc[]).filter(
    (t) =>
      Boolean(t.stripeConnectAccountId?.trim()) &&
      t.stripeConnectOnboardingStatus === 'active',
  )
  return connected.map((t) => t.id)
}

/**
 * Read: admin sees all; tenant-admin sees only products whose tenant has Connect connected;
 * other users and unauthenticated can read (for booking pages / API).
 */
export const productsRequireStripeConnectRead: Access = async (args) => {
  const { req } = args
  const user = req.user
  const connected = await getConnectedTenantIds(args)
  if (connected === null) return true
  if (connected.length === 0) {
    if (user && checkRole(['admin'], user as unknown as SharedUser)) {
      return false
    }
    return true
  }
  return { tenant: { in: connected } }
}

/**
 * Create: admin can create for any tenant; tenant-admin only for tenants with Connect connected.
 * If data.tenant or context.tenant is set, it must be in connected list; otherwise allow if they have any connected tenant (hook will set tenant).
 */
export const productsRequireStripeConnectCreate: Access = async (args) => {
  const connected = await getConnectedTenantIds(args)
  if (connected === null) return true
  if (connected.length === 0) return false

  const { data, req } = args
  const dataTenant = data?.tenant
  if (dataTenant) {
    const id =
      typeof dataTenant === 'object' && dataTenant !== null && 'id' in dataTenant
        ? (dataTenant as { id: number }).id
        : dataTenant
    if (typeof id === 'number' && connected.includes(id)) return true
  }
  const contextTenant = req.context?.tenant
  if (contextTenant) {
    const id =
      typeof contextTenant === 'object' &&
      contextTenant !== null &&
      'id' in contextTenant
        ? (contextTenant as { id: number }).id
        : contextTenant
    if (typeof id === 'number' && connected.includes(id)) return true
  }
  return true
}

/**
 * Update: admin can update any; tenant-admin only documents whose tenant has Connect connected.
 */
export const productsRequireStripeConnectUpdate: Access = async (args) => {
  const connected = await getConnectedTenantIds(args)
  if (connected === null) return true
  if (connected.length === 0) return false
  return { tenant: { in: connected } }
}

/**
 * Delete: admin can delete any; tenant-admin only documents whose tenant has Connect connected.
 */
export const productsRequireStripeConnectDelete: Access = async (args) => {
  const connected = await getConnectedTenantIds(args)
  if (connected === null) return true
  if (connected.length === 0) return false
  return { tenant: { in: connected } }
}

/**
 * Admin (sidebar visibility): admin always sees Products; tenant-admin only if at least one of their tenants has Connect connected.
 * Typed to return only boolean so it satisfies Payload's access.admin signature.
 */
export const productsRequireStripeConnectAdmin: (
  args: AccessArgs,
) => boolean | Promise<boolean> = async (args) => {
  const connected = await getConnectedTenantIds(args)
  if (connected === null) return true
  return connected.length > 0
}

/**
 * Field-level access: only super-admin can read/create/update.
 * Use for skipSync, stripeProductId, priceJSON, priceInformation so tenant-admins never see or edit these.
 * Typed with { req } only so it's assignable to both collection AccessArgs and field FieldAccessArgs (id: string | number).
 */
export const adminOnlyFieldAccess = {
  read: ({ req }: { req: AccessArgs['req'] }) => isAdmin(req.user),
  create: ({ req }: { req: AccessArgs['req'] }) => isAdmin(req.user),
  update: ({ req }: { req: AccessArgs['req'] }) => isAdmin(req.user),
}

/**
 * Field-level access for merchant-editable product config.
 * Tenant-admins need this for membership pricing so Stripe price sync can run,
 * while Stripe internal fields remain admin-only.
 */
export const adminOrTenantAdminFieldAccess = {
  read: ({ req }: { req: AccessArgs['req'] }) =>
    isAdmin(req.user) || isTenantAdmin(req.user),
  create: ({ req }: { req: AccessArgs['req'] }) =>
    isAdmin(req.user) || isTenantAdmin(req.user),
  update: ({ req }: { req: AccessArgs['req'] }) =>
    isAdmin(req.user) || isTenantAdmin(req.user),
}
