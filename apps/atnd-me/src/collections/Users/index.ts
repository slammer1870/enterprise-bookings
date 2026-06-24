import type { CollectionConfig } from 'payload'
import { checkRole, getEffectiveUserRoles } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'

import { authenticated } from '../../access/authenticated'
import {
  getTenantMembershipIdsFromUserDoc,
  getUserTenantIds,
  loadUserDocForTenantMembership,
  resolveTenantAdminTenantIds,
} from '../../access/tenant-scoped'
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
import { resolveTenantIdForDocumentWrite } from '@/utilities/resolveTenantIdForDocumentWrite'

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
          // Covers both tenant-admins ('admin' role) and platform super-admins ('super-admin' role).
          if (user && checkRole(['admin', 'super-admin'], user as unknown as SharedUser)) {
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
              } else {
                // super-admin (getUserTenantIds returns null) or admin with no loaded tenants:
                // fall back to the TenantSelector cookie (payload-tenant) set in the admin UI.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const fromSelector = await resolveTenantIdForDocumentWrite(req as any)
                if (fromSelector != null && fromSelector !== '') {
                  ;(data as { registrationTenant?: string | number }).registrationTenant = fromSelector
                }
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
      // Prevent non–super-admins from granting super-admin. Tenant org admins may assign `user`, `admin`, `staff`, and `location-manager` only.
      // Also prevents cross-tenant privilege escalation: a tenant admin cannot grant elevated roles
      // (admin / location-manager) to users whose tenant memberships extend beyond the granting
      // admin's own tenants. Without this guard, Tenant A's admin could promote a user registered
      // at Tenant B, which would give that user Tenant B admin panel access.
      async ({ data, req, originalDoc, operation }) => {
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
                    typeof r === 'string' &&
                    r !== 'admin' &&
                    r !== 'super-admin' &&
                    r !== 'location-manager',
                ),
              ),
            ]
            d.role = cleaned.length > 0 ? cleaned : ['user']
          }
        }

        const TENANT_ASSIGNABLE_ROLES = new Set(['user', 'admin', 'staff', 'location-manager'])
        // Roles that grant Payload admin panel access – elevating a cross-tenant user to these
        // would give them admin access to a tenant the granting admin does not control.
        const CROSS_TENANT_BLOCKED_ROLES = new Set(['admin', 'location-manager'])

        if (req.user && isTenantAdmin(req.user) && d.role !== undefined) {
          const desiredRaw = Array.isArray(d.role) ? d.role : [d.role]
          const desired = desiredRaw.filter((r): r is string => typeof r === 'string' && r.length > 0)
          let allowedOnly = [...new Set(desired.filter((r) => TENANT_ASSIGNABLE_ROLES.has(r)))]

          // Cross-tenant escalation guard: if assigning an elevated role, ensure all of the
          // target user's tenant memberships fall within the granting admin's own tenants.
          const isGrantingElevatedRole = allowedOnly.some((r) => CROSS_TENANT_BLOCKED_ROLES.has(r))
          if (isGrantingElevatedRole) {
            const grantingAdminTenantIds = await resolveTenantAdminTenantIds({
              user: req.user,
              payload: req.payload,
              context: req.context as Record<string, unknown> | undefined,
            })

            if (grantingAdminTenantIds.length > 0) {
              let targetMemberships: number[] = []

              if (operation === 'update' && originalDoc) {
                // Load the full user doc so tenants join-table fields are populated
                // (originalDoc is fetched at depth 0 and may omit relationship arrays).
                const targetIdRaw = (originalDoc as { id?: unknown }).id
                const targetId =
                  typeof targetIdRaw === 'number'
                    ? targetIdRaw
                    : typeof targetIdRaw === 'string' && /^\d+$/.test(targetIdRaw)
                      ? parseInt(targetIdRaw, 10)
                      : null

                if (targetId != null) {
                  const fullDoc = await loadUserDocForTenantMembership(req.payload, targetId)
                  targetMemberships = getTenantMembershipIdsFromUserDoc(fullDoc ?? originalDoc)
                } else {
                  targetMemberships = getTenantMembershipIdsFromUserDoc(originalDoc)
                }
              } else if (operation === 'create') {
                // On creates, check the registrationTenant being set in this request.
                // The first beforeChange hook already set data.registrationTenant from the
                // admin's context, but an admin could have overridden it explicitly.
                const regRaw = (data as { registrationTenant?: unknown }).registrationTenant
                const regId =
                  typeof regRaw === 'number'
                    ? regRaw
                    : typeof regRaw === 'object' && regRaw !== null && 'id' in regRaw
                      ? (regRaw as { id: number }).id
                      : typeof regRaw === 'string' && /^\d+$/.test(regRaw)
                        ? parseInt(regRaw, 10)
                        : null
                if (regId != null) targetMemberships = [regId]
              }

              const hasExternalMembership = targetMemberships.some(
                (tid) => !grantingAdminTenantIds.includes(tid),
              )
              if (hasExternalMembership) {
                allowedOnly = allowedOnly.filter((r) => !CROSS_TENANT_BLOCKED_ROLES.has(r))
              }
            }
          }

          d.role = allowedOnly.length > 0 ? allowedOnly : ['user']

          // Maintain tenantRoles in parallel with the global role field.
          // This keeps the per-tenant roles structure in sync whenever a tenant admin assigns
          // a role via the admin UI or API.
          const finalRoles = Array.isArray(d.role) ? (d.role as string[]) : ([d.role].filter(Boolean) as string[])
          const tenantScopedRoles = finalRoles.filter((r) => TENANT_ASSIGNABLE_ROLES.has(r))

          const grantingIds = await resolveTenantAdminTenantIds({
            user: req.user,
            payload: req.payload,
            context: req.context as Record<string, unknown> | undefined,
          })

          if (grantingIds.length > 0) {
            // Load current tenantRoles from the DB doc (originalDoc may be depth-0).
            let currentTenantRoles: Array<{ tenant: number; roles: string[] }> = []
            const targetIdRaw = (originalDoc as { id?: unknown } | undefined)?.id
            const targetId =
              typeof targetIdRaw === 'number'
                ? targetIdRaw
                : typeof targetIdRaw === 'string' && /^\d+$/.test(targetIdRaw)
                  ? parseInt(targetIdRaw, 10)
                  : null

            if (targetId != null) {
              const fullDoc = await loadUserDocForTenantMembership(req.payload, targetId)
              if (fullDoc) {
                const raw = (fullDoc as Record<string, unknown>).tenantRoles
                if (Array.isArray(raw)) {
                  currentTenantRoles = raw
                    .map((entry) => {
                      if (!entry || typeof entry !== 'object') return null
                      const e = entry as Record<string, unknown>
                      const tenantRaw = e.tenant
                      const tenantId =
                        typeof tenantRaw === 'number'
                          ? tenantRaw
                          : typeof tenantRaw === 'object' && tenantRaw !== null && 'id' in tenantRaw
                            ? (tenantRaw as { id: number }).id
                            : typeof tenantRaw === 'string' && /^\d+$/.test(tenantRaw)
                              ? parseInt(tenantRaw, 10)
                              : null
                      if (tenantId == null) return null
                      const roles = Array.isArray(e.roles)
                        ? (e.roles.filter((r) => typeof r === 'string') as string[])
                        : []
                      return { tenant: tenantId, roles }
                    })
                    .filter((e): e is { tenant: number; roles: string[] } => e !== null)
                }
              }
            }

            // Upsert: for each of the granting admin's tenants, set the roles to the final value.
            const updated = [...currentTenantRoles]
            for (const tid of grantingIds) {
              const existingIdx = updated.findIndex((e) => e.tenant === tid)
              const entry = { tenant: tid, roles: tenantScopedRoles.length > 0 ? tenantScopedRoles : ['user'] }
              if (existingIdx >= 0) {
                updated[existingIdx] = entry
              } else {
                updated.push(entry)
              }
            }
            ;(data as Record<string, unknown>).tenantRoles = updated
          }
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
    {
      name: 'locations',
      type: 'relationship',
      relationTo: 'locations',
      hasMany: true,
      admin: {
        description:
          'Branches this user manages (location manager). Org admins assign these; managers cannot self-assign.',
      },
      access: {
        read: userSensitiveFieldReadForStaffRoster,
        update: ({ req: { user } }) => {
          if (!user) return false
          return isAdmin(user) || isTenantAdmin(user)
        },
      },
      filterOptions: ({ data, req }) => {
        if (req.user && (isAdmin(req.user) || isTenantAdmin(req.user))) return true
        const tenantIds = getTenantMembershipIdsFromUserDoc(data as SharedUser)
        if (!tenantIds.length) return false
        return { tenant: { in: tenantIds } }
      },
    },
    // Per-tenant role assignments. This is the authoritative source for "what role does this
    // user have at a specific tenant?" and replaces the blunt global `role` field for all
    // non-super-admin purposes. Maintained automatically by the role-assignment beforeChange hook.
    //
    // During the migration window this field may be empty, in which case access control falls
    // back to the global `role` + `tenants` membership (existing behaviour). After the
    // db:migrate-to-tenant-roles script is run in production the fallback is never hit.
    {
      name: 'tenantRoles',
      type: 'array',
      label: 'Per-tenant roles',
      admin: {
        description:
          'Role assignments per tenant. Automatically maintained — edit with care.',
        position: 'sidebar',
      },
      access: {
        read: ({ req: { user } }) => {
          if (!user) return false
          return isAdmin(user) || isTenantAdmin(user)
        },
        update: ({ req: { user } }) => {
          if (!user) return false
          return isAdmin(user) || isTenantAdmin(user)
        },
      },
      fields: [
        {
          name: 'tenant',
          type: 'relationship',
          relationTo: 'tenants',
          required: true,
          admin: { description: 'The tenant this role applies to.' },
        },
        {
          name: 'roles',
          type: 'select',
          hasMany: true,
          required: true,
          defaultValue: ['user'],
          options: [
            { label: 'Admin', value: 'admin' },
            { label: 'Staff', value: 'staff' },
            { label: 'Location Manager', value: 'location-manager' },
            { label: 'User', value: 'user' },
          ],
        },
      ],
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
