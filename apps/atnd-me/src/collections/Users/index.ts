import type { CollectionConfig } from 'payload'
import { checkRole, getEffectiveUserRoles } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { tenantsArrayField } from '@payloadcms/plugin-multi-tenant/fields'

import { authenticated } from '../../access/authenticated'
import {
  getTenantMembershipIdsFromUserDoc,
  getUserTenantIds,
  loadUserDocForTenantMembership,
  resolveOrgAdminTenantIds,
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

import { afterLoginRedirect } from './hooks/afterLoginRedirect'
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
import { isSystemUserWrite } from '@/lib/auth/systemUserWriteContext'
import { getAbsoluteURL } from '@/utilities/getURL'
import { resolveTrustedPasswordResetOrigin } from '@/utilities/resolveTrustedPasswordResetOrigin'
import {
  assertAnonymousUserCreateRateLimit,
  normalizeTenantRoles,
  sanitizeUserTenantsAndRolesForWrite,
} from './sanitizeUserWrite'
import { stripForeignTenantsBeforeValidate } from './stripForeignTenantsBeforeValidate'
import { usersTenantsTenantFilterOptions } from './tenantsTenantFilterOptions'
import { validateTenantsMembershipArray } from './validateTenantsMembershipArray'
import { EMERGENCY_CONTACTS_SLUG } from '@/collections/EmergencyContacts'

/**
 * Consolidated tenants membership field: replaces the separate `tenantRoles` array.
 * Each entry captures both tenant membership AND per-tenant role assignments in one place.
 * The `roles` rowField is the authoritative source for per-tenant access decisions.
 */
/** Super-admin only in the admin UI (field still exists for hooks / platform ops). */
const superAdminOnlyAdminCondition = (_data: unknown, _sibling: unknown, { user }: { user?: unknown }) =>
  Boolean(user && isAdmin(user))

const tenantsMembershipArrayField = tenantsArrayField({
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
      hooks: {
        // Runs immediately before field validation (after collection beforeChange).
        // Guests / legacy rows can arrive with empty, duplicate, or `{ value }` roles —
        // Payload then fails with "Tenants N > Roles". Always coerce to a valid list.
        beforeChange: [({ value }) => normalizeTenantRoles(value)],
      },
      access: {
        // Admins / tenant-admins in the panel; system Local API via explicit context flag.
        // Never open to anonymous HTTP (Users.create is otherwise public).
        create: ({ req }: { req: { user?: unknown; context?: Record<string, unknown> } }) =>
          isSystemUserWrite(req) ||
          Boolean(req.user && (isAdmin(req.user) || isTenantAdmin(req.user))),
        update: ({ req }: { req: { user?: unknown; context?: Record<string, unknown> } }) =>
          isSystemUserWrite(req) ||
          Boolean(req.user && (isAdmin(req.user) || isTenantAdmin(req.user))),
      },
    },
    {
      name: 'locations',
      type: 'relationship',
      relationTo: 'locations',
      hasMany: true,
      required: false,
      admin: {
        description:
          'Branches this staff / location-manager can access. Leave empty for all locations. Hidden when the row includes Admin (admins always get all locations).',
        condition: (_data, siblingData) => {
          const roles = Array.isArray((siblingData as { roles?: unknown })?.roles)
            ? ((siblingData as { roles: unknown[] }).roles as string[])
            : []
          if (roles.includes('admin')) return false
          return roles.includes('staff') || roles.includes('location-manager')
        },
      },
      access: {
        create: ({ req }: { req: { user?: unknown; context?: Record<string, unknown> } }) =>
          isSystemUserWrite(req) ||
          Boolean(req.user && (isAdmin(req.user) || isTenantAdmin(req.user))),
        update: ({ req }: { req: { user?: unknown; context?: Record<string, unknown> } }) =>
          isSystemUserWrite(req) ||
          Boolean(req.user && (isAdmin(req.user) || isTenantAdmin(req.user))),
      },
      filterOptions: ({ siblingData }) => {
        const tenant = (siblingData as { tenant?: unknown } | undefined)?.tenant
        const tid =
          tenant && typeof tenant === 'object' && tenant !== null && 'id' in tenant
            ? (tenant as { id: unknown }).id
            : tenant
        if (tid == null || tid === '') return false
        return { tenant: { equals: tid } }
      },
    },
  ],
  arrayFieldAccess: {
    read: ({ req }: { req: { user?: unknown; context?: Record<string, unknown> } }) =>
      isSystemUserWrite(req) ||
      Boolean(req.user && (isAdmin(req.user) || isTenantAdmin(req.user))),
    update: ({ req }: { req: { user?: unknown; context?: Record<string, unknown> } }) =>
      isSystemUserWrite(req) ||
      Boolean(req.user && (isAdmin(req.user) || isTenantAdmin(req.user))),
  },
})

{
  const tenantRel = tenantsMembershipArrayField.fields.find(
    (f) => 'name' in f && f.name === 'tenant',
  )
  if (tenantRel && tenantRel.type === 'relationship') {
    // Org admins: filterOptions returns true for relationship validation because
    // beforeChange re-merges foreign DB rows before field validate runs. The picker
    // is scoped by Tenants.read → resolveOrgAdminTenantIds.
    tenantRel.filterOptions = usersTenantsTenantFilterOptions
  }
}

const tenantsMembershipField = {
  ...tenantsMembershipArrayField,
  validate: validateTenantsMembershipArray,
  admin: {
    ...tenantsMembershipArrayField.admin,
    position: 'sidebar' as const,
    description:
      'Tenant memberships and per-tenant roles. Org admins can only assign tenants they administer (same count as their own). Locations appear for Staff / Location Manager rows (empty = all locations).',
    components: {
      ...(tenantsMembershipArrayField.admin &&
      typeof tenantsMembershipArrayField.admin === 'object' &&
      'components' in tenantsMembershipArrayField.admin
        ? (tenantsMembershipArrayField.admin as { components?: Record<string, unknown> })
            .components
        : {}),
      Field: '@/components/admin/users/TenantsMembershipArrayField#TenantsMembershipArrayField',
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
  // Merged by payload-auth's Better Auth users builder (`...existingUserCollection.auth`).
  // Payload's default getRequestOrigin() returns '' when Host is not an exact CORS match
  // (tenant subdomains / proxy proto mismatch), producing a relative `/admin/reset/<token>`
  // link. Build an absolute, trusted origin instead (tenant host when allowed, else platform).
  auth: {
    forgotPassword: {
      generateEmailHTML: async (args) => {
        const req = args?.req
        const token = args?.token
        const user = args?.user
        const adminRoute = req?.payload?.config?.routes?.admin || '/admin'
        const resetRoute = req?.payload?.config?.admin?.routes?.reset || '/reset'
        const origin = await resolveTrustedPasswordResetOrigin({
          headers: req?.headers,
          payload: req?.payload,
        })
        const resetURL = getAbsoluteURL(`${adminRoute}${resetRoute}/${token ?? ''}`, origin)
        const email = typeof user?.email === 'string' ? user.email : 'there'
        return `You are receiving this because you (or someone else) requested a password reset for ${email}.
<a href="${resetURL}">${resetURL}</a>
If you did not request this, you can ignore this email.`
      },
    },
  },
  hooks: {
    afterLogin: [afterLoginRedirect],
    beforeOperation: [
      async ({ args, operation, req }) => {
        if (operation === 'create') {
          assertAnonymousUserCreateRateLimit(req)
        }
        return args
      },
    ],
    beforeValidate: [
      // Strip foreign tenant entries before relationship validation.
      // NOTE: payload-auth drops `beforeValidate` — also re-attached in
      // `fixBetterAuthUsersHooks` (see plugins/fix-better-auth-after-read-hooks.ts).
      async ({ data, req }) =>
        stripForeignTenantsBeforeValidate({
          data: data as Record<string, unknown> | null | undefined,
          req,
        }),
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
        // let resolveOrgAdminTenantIds be the single source of truth — it loads the full
        // user doc from DB (with overrideAccess:true) and checks tenants[n].roles directly.
        const adminTenantIds = await resolveOrgAdminTenantIds({
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
      // Harden anonymous + system user writes (tenants / roles).
      // System flows set ATND_SYSTEM_USER_WRITE_CTX + allowedRoles allow-list.
      async ({ data, req }) => {
        if (!data) return data
        return sanitizeUserTenantsAndRolesForWrite({
          data: data as Record<string, unknown>,
          req,
        })
      },
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
              // Guard against stale tenant cookies/cache after DB reset (FK on registrationTenant).
              try {
                const tenant = await req.payload.findByID({
                  collection: 'tenants',
                  id: fromRequest,
                  depth: 0,
                  overrideAccess: true,
                })
                if (tenant) {
                  ;(data as { registrationTenant?: string | number }).registrationTenant =
                    fromRequest
                }
              } catch {
                // omit registrationTenant
              }
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
              const grantingAdminTenantIds = await resolveOrgAdminTenantIds({
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
        // Foreign entries and omitted own-tenant entries (dual-admin partial forms) are
        // preserved from DB; injected foreign entries are stripped.
        //
        // Foreign rows are stripped in beforeValidate for the form, then merged back
        // here from the DB before field validation — so tenant filterOptions stays open
        // for org admins while Tenants.read keeps the picker scoped.
        //
        // We do NOT gate this on isTenantAdmin(req.user): the `role` field may be stripped
        // from the session user by field-level access control (fixBetterAuthRoleField plugin),
        // making isTenantAdmin return false even for legitimate tenant admins. Instead we call
        // resolveOrgAdminTenantIds unconditionally and only apply the guard when it returns
        // a non-empty list (it loads the full user from DB and checks tenants[n].roles).
        if (req.user && !isAdmin(req.user) &&
            (data as Record<string, unknown>).tenants !== undefined) {
          const grantingAdminTenantIds = await resolveOrgAdminTenantIds({
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

        // Authoritative existing roles — used by BOTH the derive-role block and the re-injection
        // block below. Normally sourced from originalDoc (which Payload fetches with
        // overrideAccess:true). As a safety net, if super-admin is not found there, we do an
        // explicit DB lookup with overrideAccess:true to guard against any edge case where
        // originalDoc.role was unexpectedly absent (e.g. a prior migration stripping the field).
        let authoritativeExistingRoles = operation === 'update'
          ? getEffectiveUserRoles(originalDoc as SharedUser)
          : (Array.isArray(d.role) ? d.role : d.role ? [d.role] : []) as string[]

        if (
          operation === 'update' &&
          originalDoc &&
          !authoritativeExistingRoles.includes('super-admin')
        ) {
          const targetIdRaw = (originalDoc as { id?: unknown }).id
          const targetId =
            typeof targetIdRaw === 'number'
              ? targetIdRaw
              : typeof targetIdRaw === 'string' && /^\d+$/.test(targetIdRaw)
                ? parseInt(targetIdRaw, 10)
                : null
          if (targetId != null) {
            try {
              const freshDoc = await req.payload.findByID({
                collection: 'users',
                id: targetId,
                depth: 0,
                joins: false,
                overrideAccess: true,
              })
              if (freshDoc) {
                authoritativeExistingRoles = getEffectiveUserRoles(freshDoc as SharedUser)
              }
            } catch { /* fall through and use existingRoles */ }
          }
        }

        const finalTenants = (data as Record<string, unknown>).tenants
        if (req.user && Array.isArray(finalTenants) && finalTenants.length > 0) {
          if (!authoritativeExistingRoles.includes('super-admin')) {
            const derived = deriveRoleFromTenants(finalTenants as TenantEntry[], authoritativeExistingRoles)
            if (d.role === undefined || !authoritativeExistingRoles.includes('super-admin')) {
              d.role = derived as typeof d.role
            }
          }
        }

        // Only enforce super-admin add/remove rules on updates. On creates, stripping here removed
        // `super-admin` from every seeded/admin user after the first DB row (tests + Local API).
        if (operation === 'update') {
          const existingHasSuperAdmin = authoritativeExistingRoles.includes('super-admin')

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
                authoritativeExistingRoles.includes('admin') || authoritativeExistingRoles.includes('staff')
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
    // `image` (upload → media) is provided by Better Auth and converted to a real
    // upload field in `fixBetterAuthImageField` (staff photos migrate onto it).
    {
      name: 'emergencyContacts',
      label: 'Emergency contacts',
      type: 'join',
      collection: EMERGENCY_CONTACTS_SLUG,
      on: 'user',
      admin: {
        description:
          'Family emergency contact records for this account holder (one per tenant when completed).',
        defaultColumns: ['peopleSummary', 'primaryContact', 'status', 'completedAt'],
      },
    },
    {
      name: 'registrationTenant',
      type: 'relationship',
      relationTo: 'tenants',
      admin: {
        description:
          'The tenant this user originally registered with (based on domain / subdomain).',
        condition: superAdminOnlyAdminCondition,
        disableListColumn: true,
      },
      // Note: Field-level access control can only return boolean values.
      // The relationship dropdown is automatically filtered by the Tenants collection's read access control.
      // A beforeChange hook sets this for tenant-admin creates and public sign-up (host/cookies).
      access: {
        read: userSensitiveFieldReadForStaffRoster,
        update: ({ req: { user } }) => Boolean(user && isAdmin(user)),
      },
    },
    {
      name: 'onboardingPasswordSetAt',
      type: 'date',
      required: false,
      admin: {
        description:
          'When the user set a password from the onboarding checklist (claim flow creates a random password).',
        position: 'sidebar',
        readOnly: true,
        condition: superAdminOnlyAdminCondition,
      },
      access: {
        read: ({ req: { user } }) => Boolean(user && isAdmin(user)),
        update: ({ req: { user } }) => Boolean(user && isAdmin(user)),
      },
    },
    // Consolidated tenants membership + per-tenant roles (+ optional branch assignments).
    // The multi-tenant plugin's auto-add is disabled (includeDefaultField: false in plugins/index.ts)
    // so we place this field manually here with the `roles` / `locations` rowFields for full control.
    tenantsMembershipField,
    {
      name: 'tenantStripeCustomerMapping',
      type: 'ui',
      admin: {
        position: 'sidebar',
        condition: superAdminOnlyAdminCondition,
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
