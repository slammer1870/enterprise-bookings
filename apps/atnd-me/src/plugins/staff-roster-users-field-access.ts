import type { CollectionConfig, Config, Field, FieldAccess, Plugin } from 'payload'

import {
  STAFF_ROSTER_SENSITIVE_FIELD_NAMES,
  userNameFieldReadForStaffRoster,
  userSensitiveFieldReadForStaffRoster,
  userTimestampFieldReadForStaffRoster,
} from '@/access/staffRosterUserFieldAccess'
import { isStaffOnlyUser } from '@/access/userTenantAccess'

function mergeFieldRead(field: Field, read: FieldAccess): Field {
  const f = field as Field & { access?: { read?: FieldAccess } }
  const prev = typeof f.access?.read === 'function' ? f.access.read : undefined
  return {
    ...field,
    access: {
      ...(typeof f.access === 'object' && f.access ? f.access : {}),
      read: (args) => {
        const next = read(args)
        if (!next) return false
        if (prev) return prev(args) as boolean
        return true
      },
    },
  } as Field
}

function patchUsersField(field: Field): Field {
  const f = field as Field & { name?: string; fields?: Field[]; admin?: { condition?: unknown } }

  if ('fields' in f && Array.isArray(f.fields)) {
    return { ...f, fields: f.fields.map(patchUsersField) } as Field
  }

  if (!('name' in f) || !f.name) return field

  const name = f.name

  if (name === 'tenantStripeCustomerMapping' || name === 'stripeCustomerDashboardLink') {
    const prevCond = f.admin?.condition
    return {
      ...f,
      admin: {
        ...f.admin,
        condition: (data: unknown, siblingData: unknown, context: { user?: unknown }) => {
          if (isStaffOnlyUser(context?.user)) return false
          return typeof prevCond === 'function'
            ? (prevCond as (a: unknown, b: unknown, c: unknown) => boolean)(data, siblingData, context)
            : true
        },
      },
    } as Field
  }

  if (name === 'name') {
    return mergeFieldRead(field, userNameFieldReadForStaffRoster)
  }

  if (STAFF_ROSTER_SENSITIVE_FIELD_NAMES.has(name)) {
    return mergeFieldRead(field, userSensitiveFieldReadForStaffRoster)
  }

  if (name === 'createdAt' || name === 'updatedAt') {
    return mergeFieldRead(field, userTimestampFieldReadForStaffRoster)
  }

  return field
}

/**
 * After Better Auth + multi-tenant merge: tighten field read + hide billing UI for staff-only roster.
 */
export function staffRosterUsersFieldAccessPlugin(): Plugin {
  return (incomingConfig: Config): Config => {
    const collections = incomingConfig.collections || []
    const next = collections.map((coll): CollectionConfig => {
      if (!('slug' in coll) || coll.slug !== 'users') return coll
      const fields = coll.fields || []
      return {
        ...coll,
        fields: fields.map(patchUsersField),
      }
    })
    return { ...incomingConfig, collections: next }
  }
}
