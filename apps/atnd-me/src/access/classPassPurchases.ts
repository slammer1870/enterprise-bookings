import type { Access, AccessArgs } from 'payload'

import { getConnectedTenantIds } from './productsRequireStripeConnect'

const connectedTenantIds = (args: AccessArgs) =>
  getConnectedTenantIds(args, { allowLocationManager: true })

/**
 * Class-pass purchases are tenant-scoped. Location managers can manage
 * purchases for their connected tenant(s), while the collection's tenant
 * access still prevents cross-tenant reads and writes.
 */
export const classPassPurchasesReadAccess: Access = async (args) => {
  const connected = await connectedTenantIds(args)
  if (connected === null) return true
  if (connected.length === 0) return false
  return { tenant: { in: connected } }
}

export const classPassPurchasesAdminAccess = async (args: AccessArgs): Promise<boolean> => {
  const connected = await connectedTenantIds(args)
  return connected === null || connected.length > 0
}

export const classPassPurchasesCreateAccess: Access = async (args) => {
  const connected = await connectedTenantIds(args)
  if (connected === null) return true
  if (connected.length === 0) return false

  const dataTenant = args.data?.tenant
  if (dataTenant != null && dataTenant !== '') {
    const id =
      typeof dataTenant === 'object' && dataTenant !== null && 'id' in dataTenant
        ? (dataTenant as { id: unknown }).id
        : dataTenant
    if (typeof id === 'number' && connected.includes(id)) return true
  }

  const contextTenant = args.req.context?.tenant
  if (contextTenant != null && contextTenant !== '') {
    const id =
      typeof contextTenant === 'object' && contextTenant !== null && 'id' in contextTenant
        ? (contextTenant as { id: unknown }).id
        : contextTenant
    if (typeof id === 'number' && connected.includes(id)) return true
  }

  // The tenant selector hook supplies the tenant before validation.
  return true
}

export const classPassPurchasesUpdateAccess: Access = async (args) => {
  const connected = await connectedTenantIds(args)
  if (connected === null) return true
  if (connected.length === 0) return false
  return { tenant: { in: connected } }
}

export const classPassPurchasesDeleteAccess: Access = async (args) => {
  const connected = await connectedTenantIds(args)
  if (connected === null) return true
  if (connected.length === 0) return false
  return { tenant: { in: connected } }
}
