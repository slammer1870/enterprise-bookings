import type { CollectionConfig } from 'payload'
import { checkRole, getEffectiveUserRoles } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'

import { authenticated } from '../../access/authenticated'
import { getUserTenantIds } from '../../access/tenant-scoped'
import { userSensitiveFieldReadForStaffRoster } from '../../access/staffRosterUserFieldAccess'
import {
  userTenantRead,
  userTenantUpdate,
  isAdmin,
  isTenantAdmin,
  isStaff,
  usersPayloadAdminAccess,
} from '../../access/userTenantAccess'

import { applyFirstUserSuperAdminRole } from './firstUserSuperAdmin'
import { getTenantIdForCreateRequest } from '@/utilities/getTenantContext'
import { cookiesFromHeaders } from '@/utilities/cookiesFromHeaders'

const FIRST_USER_CREATE_CTX = '__atndFirstUserCreate' as const

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: usersPayloadAdminAccess,
    create: () => true,
    delete: (args) => {
      // Admin can delete any user
      const { req: { user } } = args
      if (user && isAdmin(user)) return true
      return authenticated(args)
    },
    read: userTenantRead,
    update: userTenantUpdate,
  },
  hooks: {
    beforeChange: [
      // Must run in beforeChange (not beforeValidate): payload-auth's Better Auth merge replaces
      // `hooks` and drops `beforeValidate`. Better Auth user creates also omit `req` on `payload.create`
      // — those flows set `registrationTenant` via Better Auth `databaseHooks` (see atnd-me auth options).
      async ({ data, operation, req }) => {
        if (operation === 'create' && data && !data.registrationTenant) {
          const user = req.user
          if (user && checkRole(['admin'], user as unknown as SharedUser)) {
            const rawTenant = req.context?.tenant as unknown
            if (rawTenant) {
              ;(data as { registrationTenant?: string | number }).registrationTenant =
                typeof rawTenant === 'object' && rawTenant !== null && 'id' in rawTenant
                  ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (rawTenant as any).id
                  : (rawTenant as string | number)
            } else {
              const tenantIds = getUserTenantIds(user as unknown as SharedUser)
              if (tenantIds && tenantIds.length > 0) {
                ;(data as { registrationTenant?: string | number }).registrationTenant = tenantIds[0]
              }
            }
          } else if (!user && req.headers && typeof (req.headers as Headers).get === 'function') {
            const headers = req.headers as Headers
            const fromRequest = await getTenantIdForCreateRequest(req.payload, {
              headers,
              cookies: cookiesFromHeaders(headers),
              context: req.context as { tenant?: unknown } | undefined,
            })
            if (fromRequest != null && fromRequest !== '') {
              ;(data as { registrationTenant?: string | number }).registrationTenant = fromRequest
            }
          }
        }
        return data
      },
      async ({ data, operation, req }) => {
        if (!data || operation !== 'create') return data
        const { totalDocs } = await req.payload.find({
          collection: 'users',
          limit: 0,
          depth: 0,
          overrideAccess: true,
        })
        const isFirst = totalDocs === 0
        req.context = {
          ...(req.context && typeof req.context === 'object' ? req.context : {}),
          [FIRST_USER_CREATE_CTX]: isFirst,
        } as typeof req.context
        if (isFirst) {
          applyFirstUserSuperAdminRole(data as { role?: unknown }, 0)
        }
        return data
      },
      // Prevent non–super-admins from granting super-admin. Tenant org admins may assign `user`, `admin`, and `staff` only.
      ({ data, req, originalDoc, operation }) => {
        if (!data) return data
        if (req.user && isAdmin(req.user)) return data
        const d = data as { role?: string | string[] }
        const skipSuperAdminStrip =
          (req.context as Record<string, unknown> | undefined)?.[FIRST_USER_CREATE_CTX] === true

        // Staff cannot assign org admin or platform super-admin (defense in depth beside field access).
        if (req.user && isStaff(req.user) && !isTenantAdmin(req.user) && d.role !== undefined) {
          if (operation === 'update' && originalDoc) {
            d.role = getEffectiveUserRoles(originalDoc as SharedUser) as typeof d.role
          } else if (operation === 'create') {
            const raw = Array.isArray(d.role) ? d.role : [d.role]
            const cleaned = [
              ...new Set(
                raw.filter(
                  (r): r is string =>
                    typeof r === 'string' && r !== 'admin' && r !== 'super-admin',
                ),
              ),
            ]
            d.role = cleaned.length > 0 ? cleaned : ['user']
          }
        }

        const TENANT_ASSIGNABLE_ROLES = new Set(['user', 'admin', 'staff'])

        if (req.user && isTenantAdmin(req.user) && d.role !== undefined) {
          const desiredRaw = Array.isArray(d.role) ? d.role : [d.role]
          const desired = desiredRaw.filter((r): r is string => typeof r === 'string' && r.length > 0)
          const allowedOnly = [...new Set(desired.filter((r) => TENANT_ASSIGNABLE_ROLES.has(r)))]
          d.role = allowedOnly.length > 0 ? allowedOnly : ['user']
        }

        // Only enforce super-admin add/remove rules on updates. On creates, stripping here removed
        // `super-admin` from every seeded/admin user after the first DB row (tests + Local API).
        if (operation === 'update') {
          const existingRoles = getEffectiveUserRoles(originalDoc as SharedUser)
          const existingHasSuperAdmin = existingRoles.includes('super-admin')

          if (!skipSuperAdminStrip && d.role !== undefined) {
            const arr = Array.isArray(d.role) ? d.role : [d.role]
            if (arr.includes('super-admin') && !existingHasSuperAdmin) {
              d.role = arr.filter((r) => r !== 'super-admin') as typeof d.role
            } else if (
              !isTenantAdmin(req.user) &&
              !arr.includes('super-admin') &&
              existingHasSuperAdmin
            ) {
              // Do not re-inject super-admin when the row mixes org/staff with super-admin (invalid);
              // otherwise a tenant org admin could not clear a mistaken super-admin assignment.
              const invalidSuperAdminCombo =
                existingRoles.includes('admin') || existingRoles.includes('staff')
              if (!invalidSuperAdminCombo) {
                d.role = [...arr, 'super-admin'] as typeof d.role
              }
            }
          }
        }
        return data
      },
    ],
  },
  admin: {
    defaultColumns: ['name', 'email', 'createdAt'],
    useAsTitle: 'name',
  },
  // Auth fields (email/name/etc) are provided by the Better Auth plugin in this repo.
  // Keep this collection lean to avoid duplicate field-name collisions.
  // Multi-tenant fields:
  // - registrationTenant (singular, custom): where user originally registered
  // - tenants (plural, plugin-managed): tenants user has access to (added automatically by multi-tenant plugin)
  fields: [
    {
      name: 'registrationTenant',
      type: 'relationship',
      relationTo: 'tenants',
      admin: {
        description:
          'The tenant this user originally registered with (based on domain / subdomain).',
      },
      // Note: Field-level access control can only return boolean values.
      // The relationship dropdown is automatically filtered by the Tenants collection's read access control.
      // A beforeChange hook sets this for tenant-admin creates and public sign-up (host/cookies).
      access: {
        read: userSensitiveFieldReadForStaffRoster,
        update: ({ req: { user } }) => {
          // Admin can always update
          if (user && checkRole(['super-admin'], user as unknown as SharedUser)) {
            return true
          }
          if (user && checkRole(['admin'], user as unknown as SharedUser)) {
            return true
          }
          return false
        },
      },
    },
    // Note: 'tenants' field is automatically added by @payloadcms/plugin-multi-tenant
    // This field tracks which tenants the user has access to (for tenant-admins or cross-tenant users)
    {
      name: 'tenantStripeCustomerMapping',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '@/components/admin/users/TenantStripeCustomerMappingField#TenantStripeCustomerMappingField',
        },
      },
    },
    {
      name: 'stripeCustomerDashboardLink',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: {
            path: '@/components/admin/StripeDashboardLinkField#StripeDashboardLinkField',
            clientProps: {
              target: 'customer',
              label: 'View customer in Stripe',
            },
          },
        },
      },
    },
  ],
  timestamps: true,
}
