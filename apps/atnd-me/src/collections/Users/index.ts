import type { CollectionConfig } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import type { User } from '@/payload-types'

import { authenticated } from '../../access/authenticated'
import { getUserTenantIds } from '../../access/tenant-scoped'
import { userTenantRead, userTenantUpdate, isAdmin, isTenantAdmin, isStaff } from '../../access/userTenantAccess'

function coerceRolesFromDoc(doc: unknown): string[] {
  if (!doc || typeof doc !== 'object') return []
  const d = doc as { roles?: unknown; role?: unknown }
  const roles = Array.isArray(d.roles) ? d.roles : null
  if (roles && roles.every((r) => typeof r === 'string')) return roles
  const role = d.role
  const roleArr = Array.isArray(role) ? role : role != null ? [role] : []
  return roleArr.filter((r): r is string => typeof r === 'string')
}

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: ({ req: { user } }) => Boolean(user && (isAdmin(user) || isTenantAdmin(user) || isStaff(user))),
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
      // Prevent non–super-admins from granting super-admin. Tenant org admins may toggle org `admin` for users they manage.
      ({ data, req, originalDoc }) => {
        if (!data || !req.user || isAdmin(req.user)) return data
        const d = data as { roles?: string[]; role?: string | string[] }

        if (isTenantAdmin(req.user) && (d.roles !== undefined || d.role !== undefined)) {
          const existing = coerceRolesFromDoc(originalDoc)

          const desired = Array.isArray(d.roles)
            ? d.roles
            : d.role !== undefined
              ? (Array.isArray(d.role) ? d.role : [d.role])
              : []

          const wantsOrgAdmin = desired.includes('admin')

          const next = wantsOrgAdmin
            ? Array.from(new Set([...existing.filter((r) => r !== 'super-admin'), 'admin']))
            : existing.filter((r) => r !== 'admin')

          const nextWithUser = next.length > 0 ? next : ['user']

          d.roles = nextWithUser
          d.role = nextWithUser
        }

        const existingRoles = coerceRolesFromDoc(originalDoc)
        const existingHasSuperAdmin = existingRoles.includes('super-admin')

        if (d.roles && Array.isArray(d.roles) && d.roles.includes('super-admin') && !existingHasSuperAdmin) {
          d.roles = d.roles.filter((r) => r !== 'super-admin')
        } else if (d.roles && Array.isArray(d.roles) && existingHasSuperAdmin && !d.roles.includes('super-admin')) {
          d.roles = [...d.roles, 'super-admin']
        }
        if (d.role !== undefined) {
          const arr = Array.isArray(d.role) ? d.role : [d.role]
          if (arr.includes('super-admin') && !existingHasSuperAdmin) {
            d.role = arr.filter((r) => r !== 'super-admin') as typeof d.role
          } else if (!arr.includes('super-admin') && existingHasSuperAdmin) {
            d.role = [...arr, 'super-admin'] as typeof d.role
          }
        }
        return data
      },
    ],
    afterChange: [
      // First user becomes platform super-admin.
      async ({ doc, operation, req }) => {
        if (operation !== 'create' || !doc?.id) return
        const count = await req.payload.find({
          collection: 'users',
          limit: 0,
          overrideAccess: true,
          depth: 0,
          select: { id: true } as any,
        })
        if (count.totalDocs !== 1) return
        const u = doc as { roles?: string[] }
        if (u.roles?.includes('super-admin')) return
        try {
          await req.payload.update({
            collection: 'users',
            id: doc.id,
            data: { roles: [...(u.roles || []), 'super-admin'] as User['roles'] },
            overrideAccess: true,
          })
          req.payload.logger.info(`Assigned super-admin to first user (ID: ${doc.id}).`)
        } catch (err) {
          // Update can throw NotFound when run immediately after create (e.g. transaction
          // isolation in tests or DB replication lag). Don't fail the create; first user can
          // be promoted to admin manually or on next login if needed.
          req.payload.logger.warn(`Could not assign admin to first user (ID: ${doc.id}): ${err instanceof Error ? err.message : String(err)}`)
        }
      },
    ],
    beforeValidate: [
      async ({ data, operation, req }) => {
        // When tenant-admin creates a user, automatically set registrationTenant from context
        // This ensures the tenant relationship is valid and the tenant-admin can create users
        if (operation === 'create' && data && !data.registrationTenant) {
          const user = req.user
          if (user && checkRole(['admin'], user as unknown as SharedUser)) {
            // Try to get tenant from context (set by multi-tenant plugin's tenant selector)
            const rawTenant = req.context?.tenant as unknown
            if (rawTenant) {
              // `tenant` may be a primitive ID or an object with an `id` field
              data.registrationTenant =
                typeof rawTenant === 'object' && rawTenant !== null && 'id' in rawTenant
                  ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (rawTenant as any).id
                  : (rawTenant as string | number)
            } else {
              // Fallback: use the first tenant from the tenant-admin's tenants array
              const tenantIds = getUserTenantIds(user as unknown as SharedUser)
              if (tenantIds && tenantIds.length > 0) {
                data.registrationTenant = tenantIds[0]
              }
            }
          }
        }
        return data
      },
    ],
  },
  admin: {
    defaultColumns: ['name', 'email'],
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
      // The beforeValidate hook will automatically set this field for tenant-admin users.
      access: {
        read: () => true, // Always allow reading the field value
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
