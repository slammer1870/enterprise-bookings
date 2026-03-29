/**
 * Phase 4.5 – Plans read access: productsRequireStripeConnectRead + exclude soft-deleted (deletedAt null).
 */
import type { Access } from 'payload'
import { productsRequireStripeConnectRead } from './productsRequireStripeConnect'

const noDeletedConstraint = { deletedAt: { equals: null } }

export const plansReadWithSoftDelete: Access = async (args) => {
  const base = await productsRequireStripeConnectRead(args)
  if (base === false) return false
  if (base === true) return noDeletedConstraint
  return { and: [base, noDeletedConstraint] }
}
