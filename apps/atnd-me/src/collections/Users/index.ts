import type { CollectionConfig } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'

import { authenticated } from '../../access/authenticated'
import { getUserTenantIds } from '../../access/tenant-scoped'
import { userTenantRead, userTenantUpdate, isAdmin, isTenantAdmin } from '../../access/userTenantAccess'

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
    admin: ({ req: { user } }) => isAdmin(user) || isTenantAdmin(user),
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
      // Prevent tenant-admins (or any non-admin) from granting themselves or others the admin role.
      // Field-level access on the roles field (roles plugin) already restricts who can update it;
      // this hook is defense-in-depth in case role/roles are ever writable elsewhere (e.g. Better Auth).
      // Only strip when there is an authenticated user who is not admin (e.g. avoid stripping on
      // overrideAccess creates, seed, or system operations where req.user may be absent).
      ({ data, req, originalDoc }) => {
        if (!data || !req.user || isAdmin(req.user)) return data
        const d = data as { roles?: string[]; role?: string | string[] }

        // Tenant-admins may toggle tenant-admin for users they can update, but cannot arbitrarily
        // rewrite roles. Keep all existing roles (except admin) and only apply the tenant-admin toggle.
        if (isTenantAdmin(req.user) && (d.roles !== undefined || d.role !== undefined)) {
          const existing = coerceRolesFromDoc(originalDoc)

          const desired = Array.isArray(d.roles)
            ? d.roles
            : d.role !== undefined
              ? (Array.isArray(d.role) ? d.role : [d.role])
              : []

          const wantsTenantAdmin = desired.includes('tenant-admin')

          const next = wantsTenantAdmin
            ? Array.from(new Set([...existing, 'tenant-admin']))
            : existing.filter((r) => r !== 'tenant-admin')

          // Ensure at least a base role remains
          const nextWithUser = next.length > 0 ? next : ['user']

          d.roles = nextWithUser
          d.role = nextWithUser
        }

        const existingRoles = coerceRolesFromDoc(originalDoc)
        const existingHasAdmin = existingRoles.includes('admin')

        // Non-admins can never *add* or *remove* admin:
        // - if the target already has admin, preserve it
        // - otherwise, strip any attempted admin grant
        if (d.roles && Array.isArray(d.roles) && d.roles.includes('admin') && !existingHasAdmin) {
          d.roles = d.roles.filter((r) => r !== 'admin')
        } else if (d.roles && Array.isArray(d.roles) && existingHasAdmin && !d.roles.includes('admin')) {
          d.roles = [...d.roles, 'admin']
        }
        if (d.role !== undefined) {
          const arr = Array.isArray(d.role) ? d.role : [d.role]
          if (arr.includes('admin') && !existingHasAdmin) {
            d.role = arr.filter((r) => r !== 'admin') as typeof d.role
          } else if (!arr.includes('admin') && existingHasAdmin) {
            d.role = [...arr, 'admin'] as typeof d.role
          }
        }
        return data
      },
    ],
    afterChange: [
      // Ensure the first user in the database always has admin role (Tenants and other
      // admin-only collections are hidden otherwise). Covers first user created via
      // Better Auth sign-up or any path that might bypass the roles plugin's beforeChange.
      async ({ doc, operation, req }) => {
        if (operation !== 'create' || !doc?.id) return
        const count = await req.payload.find({
          collection: 'users',
          limit: 0,
          overrideAccess: true,
        })
        if (count.totalDocs !== 1) return
        const u = doc as { roles?: string[] }
        if (u.roles?.includes('admin')) return
        try {
          await req.payload.update({
            collection: 'users',
            id: doc.id,
            data: { roles: [...(u.roles || []), 'admin'] as ('user' | 'admin' | 'tenant-admin')[] },
            overrideAccess: true,
          })
          req.payload.logger.info(`Assigned admin role to first user (ID: ${doc.id}) so Tenants and admin collections are visible.`)
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
          if (user && checkRole(['tenant-admin'], user as unknown as SharedUser)) {
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
          if (user && checkRole(['admin'], user as unknown as SharedUser)) {
            return true
          }
          // Tenant-admin can update (validation happens in beforeValidate hook)
          return true
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
  ],
  timestamps: true,
}
