import type { CollectionConfig } from 'payload'
import { checkRole, getEffectiveUserRoles } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { tenantsArrayField } from '@payloadcms/plugin-multi-tenant/fields'

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
import {
  extractTenantId,
  filterTenantsForTenantAdmin,
  mergeTenantEntriesForAdmin,
  deriveRoleFromTenants,
  type TenantEntry,
} from './tenantHookHelpers'
import { getTenantIdForCreateRequest } from '@/utilities/getTenantContext'
import { cookiesFromHeaders } from '@/utilities/cookiesFromHeaders'
import { resolveTenantIdForDocumentWrite } from '@/utilities/resolveTenantIdForDocumentWrite'

/**
 * Consolidated tenants membership field: replaces the separate `tenantRoles` array.
 * Each entry captures both tenant membership AND per-tenant role assignments in one place.
 * The `roles` rowField is the authoritative source for per-tenant access decisions.
 */
const tenantsMembershipField = {
  ...tenantsArrayField({
    tenantsArrayFieldName: 'tenants',
    tenantsArrayTenantFieldName: 'tenant',
    tenantsCollectionSlug: 'tenants',
    rowFields: [
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
        access: {
          // Role values within the tenants array: super-admins and tenant-admins may set.
          // The beforeChange write guard is the authoritative enforcement; this is a UX guard.
          update: ({ req }: { req: { user?: unknown } }) =>
            !req.user || isAdmin(req.user) || isTenantAdmin(req.user),
        },
      },
    ],
    arrayFieldAccess: {
      read: ({ req: { user } }: { req: { user?: unknown } }) => {
        if (!user) return false
        return isAdmin(user) || isTenantAdmin(user)
      },
      update: ({ req: { user } }: { req: { user?: unknown } }) => {
        if (!user) return false
        return isAdmin(user) || isTenantAdmin(user)
      },
    },
  }),
  validate: (value: unknown) => {
    if (!Array.isArray(value)) return true
    const ids = (value as { tenant?: unknown }[]).map((entry) => {
      const t = entry?.tenant
      if (t && typeof t === 'object' && 'id' in t) return String((t as { id: unknown }).id)
      return t != null ? String(t) : null
    }).filter((id): id is string => id != null)
    if (new Set(ids).size !== ids.length) return 'Each tenant may only be added once.'
    return true
  },
  admin: {
    position: 'sidebar' as const,
    components: {
      Field: '@/components/admin/users/TenantMembershipField#TenantMembershipField',
    },
  },
}

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
    beforeValidate: [
      // Strip foreign tenant entries from submitted data before Payload runs relationship
      // validation. Without this, a tenant admin who sees cross-tenant entries in the form
      // (e.g. when form-state is built from a cached/partial load) would get a 400
      // "invalid relationships" error because Payload validates each `tenant` relationship
      // value against the requesting user's read access, and the admin can't read foreign
      // tenant documents.
      //
      // The beforeChange hook below will merge the stripped entries back from the DB after
      // validation passes, so no data is lost.
      async ({ data, req }) => {
        if (!data) return data
        if (!req.user || isAdmin(req.user)) return data
        if (!isTenantAdmin(req.user)) return data

        const tenants = (data as Record<string, unknown>).tenants
        if (!Array.isArray(tenants)) return data

        const adminTenantIds = await resolveTenantAdminTenantIds({
          user: req.user,
          payload: req.payload,
          context: req.context as Record<string, unknown> | undefined,
        })
        if (adminTenantIds.length === 0) return data

        ;(data as Record<string, unknown>).tenants = tenants.filter((e) => {
          const tid = extractTenantId((e as TenantEntry)?.tenant)
          return tid != null && adminTenantIds.includes(tid)
        })

        return data
      },
    ],
    afterRead: [
      // Filter tenants[] and registrationTenant to only entries the requesting user controls.
      // Prevents tenant admins from seeing cross-tenant membership rows when viewing a shared user.
      // Super-admins and system reads are unaffected.
      async ({ doc, req }) => {
        if (!req.user) return doc
        if (isAdmin(req.user)) return doc // super-admin: see everything

        // Do NOT use isTenantAdmin(req.user) as a gate here: session/JWT users and users
        // created via the Local API with overrideAccess:true may have their `role` field
        // stripped by field-level access control (fixBetterAuthRoleField plugin). Instead,
        // let resolveTenantAdminTenantIds be the single source of truth — it loads the full
        // user doc from DB (with overrideAccess:true) and checks tenants[n].roles directly.
        const adminTenantIds = await resolveTenantAdminTenantIds({
          user: req.user,
          payload: req.payload,
          context: req.context as Record<string, unknown> | undefined,
        })

        if (adminTenantIds.length === 0) return doc // not a tenant admin; return as-is

        return filterTenantsForTenantAdmin({
          doc: doc as Record<string, unknown>,
          adminTenantIds,
        })
      },
    ],
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
        const d = data as { role?: string | string[] }
        const skipSuperAdminStrip =
          (req.context as Record<string, unknown> | undefined)?.[FIRST_USER_CREATE_CTX] === true

        // Security guards: only apply to non-super-admins.
        //
        // Super-admins bypass the escalation guard and tenants write guard but still go through
        // the derive-role logic below so that saving a user's per-tenant roles (tenants[n].roles)
        // always keeps the global `role` field in sync. Without this, a super-admin creating or
        // updating a user via the admin panel would leave the global role as 'user' even when the
        // per-tenant roles are admin/location-manager, because the early-return previously skipped
        // the entire hook (including derive-role).
        if (!(req.user && isAdmin(req.user))) {
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

          // Cross-tenant escalation guard: if assigning an elevated role to a user who has
          // memberships in tenants the granting admin does not control, strip the elevated role.
          //
          // Important: for updates, only trigger when the elevated role is being NEWLY GRANTED
          // (not already present on the target user). Without this, any edit to a user who holds
          // admin in one tenant and location-manager in another would downgrade their global role
          // to 'user' — because the location-manager tenant is "external" to the admin granting
          // the admin role, but that role was legitimately assigned by a super-admin.
          const elevatedRolesBeingAssigned = allowedOnly.filter((r) => CROSS_TENANT_BLOCKED_ROLES.has(r))
          const isGrantingElevatedRole = elevatedRolesBeingAssigned.length > 0
          if (isGrantingElevatedRole) {
            // For updates, compare against the target user's current roles to detect true escalation.
            const existingTargetRoles =
              operation === 'update' && originalDoc
                ? getEffectiveUserRoles(originalDoc as SharedUser)
                : []
            const isActualEscalation = elevatedRolesBeingAssigned.some(
              (r) => !existingTargetRoles.includes(r),
            )

            if (isActualEscalation) {
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
            // else: all elevated roles are already present on the target user — role
            // preservation, not escalation. Skip the cross-tenant membership check so
            // legitimate multi-tenant users are not downgraded on every save.
          }

          d.role = allowedOnly.length > 0 ? allowedOnly : ['user']
        }

        // Tenants write guard: tenant admins can only modify their own tenant entries.
        // Foreign entries are preserved from DB; injected foreign entries are stripped.
        //
        // The Tenants collection `read` access returns `true` for all authenticated admins so
        // Payload's field-level relationship validation (which uses `find`) accepts the foreign
        // tenant IDs in the merged result without a 400 error.
        //
        // We do NOT gate this on isTenantAdmin(req.user): the `role` field may be stripped
        // from the session user by field-level access control (fixBetterAuthRoleField plugin),
        // making isTenantAdmin return false even for legitimate tenant admins. Instead we call
        // resolveTenantAdminTenantIds unconditionally and only apply the guard when it returns
        // a non-empty list (it loads the full user from DB and checks tenants[n].roles).
        if (req.user && !isAdmin(req.user) &&
            (data as Record<string, unknown>).tenants !== undefined) {
          const grantingAdminTenantIds = await resolveTenantAdminTenantIds({
            user: req.user,
            payload: req.payload,
            context: req.context as Record<string, unknown> | undefined,
          })

          if (grantingAdminTenantIds.length > 0) {
            const targetIdRaw = (originalDoc as { id?: unknown } | undefined)?.id
            const targetId =
              typeof targetIdRaw === 'number'
                ? targetIdRaw
                : typeof targetIdRaw === 'string' && /^\d+$/.test(targetIdRaw)
                  ? parseInt(targetIdRaw, 10)
                  : null

            let dbTenants: TenantEntry[] = []
            if (targetId != null) {
              const fullDoc = await loadUserDocForTenantMembership(req.payload, targetId)
              if (fullDoc) {
                const raw = (fullDoc as Record<string, unknown>).tenants
                if (Array.isArray(raw)) dbTenants = raw as TenantEntry[]
              }
            }

            const incoming = (data as Record<string, unknown>).tenants as TenantEntry[]
            ;(data as Record<string, unknown>).tenants = mergeTenantEntriesForAdmin({
              incoming: Array.isArray(incoming) ? incoming : [],
              adminTenantIds: grantingAdminTenantIds,
              dbTenants,
            })
          }
        }

        } // end non-super-admin guards

        // Derive the canonical global role from tenants[n].roles (JWT fast-path sync).
        // Runs for ALL authenticated users (including super-admins) when the `tenants` field is
        // present in the write payload. This ensures the global `role` is always kept in sync
        // with per-tenant role assignments regardless of who saved the user.
        //
        // Only runs for authenticated HTTP API requests (req.user present). Local API operations
        // with overrideAccess:true (seeds, test setup, admin tooling) set req.user=null and must
        // not inadvertently downgrade a user's global role when tenant entries lack explicit roles.
        const finalTenants = (data as Record<string, unknown>).tenants
        if (req.user && Array.isArray(finalTenants) && finalTenants.length > 0) {
          const existingRoles = operation === 'update'
            ? getEffectiveUserRoles(originalDoc as SharedUser)
            : (Array.isArray(d.role) ? d.role : d.role ? [d.role] : []) as string[]
          if (!existingRoles.includes('super-admin')) {
            const derived = deriveRoleFromTenants(finalTenants as TenantEntry[], existingRoles)
            if (d.role === undefined || !existingRoles.includes('super-admin')) {
              d.role = derived as typeof d.role
            }
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
    // Consolidated tenants membership + per-tenant roles array.
    // Replaces the now-removed standalone `tenantRoles` field.
    // The multi-tenant plugin's auto-add is disabled (includeDefaultField: false in plugins/index.ts)
    // so we place this field manually here with the `roles` rowField for full control.
    tenantsMembershipField,
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
