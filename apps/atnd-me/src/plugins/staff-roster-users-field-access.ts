import type { CollectionConfig, Config, Field, FieldAccess, Plugin } from 'payload'

import {
  STAFF_ROSTER_SENSITIVE_FIELD_NAMES,
  userEmailFieldReadForLocationManager,
  userEmailFieldWriteForLocationManager,
  userNameFieldReadForStaffRoster,
  userNameFieldWriteForStaffRoster,
  userSensitiveFieldReadForStaffRoster,
  userTimestampFieldReadForStaffRoster,
} from '@/access/staffRosterUserFieldAccess'
import { isStaffOnlyUser } from '@/access/userTenantAccess'

function mergeFieldAccess(
  field: Field,
  next: Partial<{ read: FieldAccess; create: FieldAccess; update: FieldAccess }>,
): Field {
  const f = field as Field & {
    access?: { read?: FieldAccess; create?: FieldAccess; update?: FieldAccess }
  }
  const prev = typeof f.access === 'object' && f.access ? f.access : {}

  const wrap = (key: 'read' | 'create' | 'update', fn?: FieldAccess): FieldAccess | undefined => {
    if (!fn) return prev[key]
    const previous = typeof prev[key] === 'function' ? prev[key] : undefined
    return (args) => {
      const allowed = fn(args)
      if (!allowed) return false
      if (previous) return previous(args) as boolean
      return true
    }
  }

  return {
    ...field,
    access: {
      ...prev,
      read: wrap('read', next.read),
      create: wrap('create', next.create),
      update: wrap('update', next.update),
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
    return mergeFieldAccess(field, {
      read: userNameFieldReadForStaffRoster,
      create: userNameFieldWriteForStaffRoster,
      update: userNameFieldWriteForStaffRoster,
    })
  }

  if (name === 'email') {
    return mergeFieldAccess(field, {
      read: userEmailFieldReadForLocationManager,
      create: userEmailFieldWriteForLocationManager,
      update: userEmailFieldWriteForLocationManager,
    })
  }

  if (STAFF_ROSTER_SENSITIVE_FIELD_NAMES.has(name)) {
    return mergeFieldAccess(field, {
      read: userSensitiveFieldReadForStaffRoster,
    })
  }

  if (name === 'createdAt' || name === 'updatedAt') {
    return mergeFieldAccess(field, {
      read: userTimestampFieldReadForStaffRoster,
    })
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
