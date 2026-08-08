import type { CollectionConfig, Config, Field, Plugin } from 'payload'

import { isAdmin } from '@/access/userTenantAccess'

/** Fields hidden from tenant admins in the Users admin UI (super-admin only). */
const SUPER_ADMIN_ONLY_UI_FIELDS = new Set([
  'banned',
  'banReason',
  'banExpires',
  'account',
  'session',
  'sessions',
  'stripeCustomerId',
  'stripeCustomers',
  'registrationTenant',
  'onboardingPasswordSetAt',
  'tenantStripeCustomerMapping',
])

function patchField(field: Field): Field {
  const f = field as Field & {
    name?: string
    fields?: Field[]
    tabs?: Array<{ fields?: Field[] }>
    admin?: { condition?: unknown }
  }

  if ('fields' in f && Array.isArray(f.fields)) {
    return { ...f, fields: f.fields.map(patchField) } as Field
  }

  if ('tabs' in f && Array.isArray(f.tabs)) {
    return {
      ...f,
      tabs: f.tabs.map((tab) => ({
        ...tab,
        fields: Array.isArray(tab.fields) ? tab.fields.map(patchField) : tab.fields,
      })),
    } as Field
  }

  if (!('name' in f) || !f.name || !SUPER_ADMIN_ONLY_UI_FIELDS.has(f.name)) {
    return field
  }

  const prevCond = f.admin?.condition
  return {
    ...f,
    admin: {
      ...f.admin,
      condition: (data: unknown, siblingData: unknown, context: { user?: unknown }) => {
        if (!isAdmin(context?.user)) return false
        return typeof prevCond === 'function'
          ? (prevCond as (a: unknown, b: unknown, c: unknown) => boolean)(data, siblingData, context)
          : true
      },
    },
  } as Field
}

/**
 * Hide Better Auth / ban / raw Stripe noise from tenant admins on the Users edit view.
 * Keeps `userSubscription` and `stripeCustomerDashboardLink` visible.
 */
export function simplifyUsersAdminForTenantAdminsPlugin(): Plugin {
  return (incomingConfig: Config): Config => {
    const collections = (incomingConfig.collections || []).map((coll): CollectionConfig => {
      if (!('slug' in coll) || coll.slug !== 'users') return coll
      return {
        ...coll,
        fields: (coll.fields || []).map(patchField),
      }
    })
    return { ...incomingConfig, collections }
  }
}
