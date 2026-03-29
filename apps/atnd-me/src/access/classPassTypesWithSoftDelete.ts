/**
 * Phase 4.5 – Class-pass-types read access: productsRequireStripeConnectRead + exclude soft-deleted.
 */
import type { Access } from 'payload'
import { productsRequireStripeConnectRead } from './productsRequireStripeConnect'

const noDeletedConstraint = { deletedAt: { equals: null } }

export const classPassTypesReadWithSoftDelete: Access = async (args) => {
  const base = await productsRequireStripeConnectRead(args)
  if (base === false) return false
  if (base === true) return noDeletedConstraint
  return { and: [base, noDeletedConstraint] }
}
