import { APIError, ValidationError } from 'payload'
import type { PayloadRequest } from 'payload'

import { isAdmin } from '../../access/userTenantAccess'
import {
  getTenantMembershipIdsFromUserDoc,
  resolveOrgAdminTenantIds,
} from '../../access/tenant-scoped'
import { canAssignRegistrationTenant } from './canAssignRegistrationTenant'
import { resolveTenantIdForUserCreate } from './ensureCreateTenantScope'
import { extractTenantId } from './tenantHookHelpers'
import {
  attachUserToTenant,
  normalizeEmail,
  rolesForTenantFromCreateData,
  type ExistingUserForAttach,
} from '@/lib/users/attachUserToTenant'

/**
 * When a tenant/portal admin creates a user whose email already exists on another
 * tenant, attach that user to the creator's tenant instead of failing on the
 * global unique email index (the existing user is invisible under userTenantRead).
 *
 * Payload cannot convert create → update mid-flight, so after a successful attach
 * we throw a ValidationError that explains the user was added and can be found
 * in the list. Already-a-member is a plain validation error (no side effect).
 */
export async function attachExistingUserOnAdminCreate(args: {
  data: Record<string, unknown> | null | undefined
  req: PayloadRequest
}): Promise<void> {
  const { data, req } = args
  if (!data || !canAssignRegistrationTenant(req.user)) return

  const rawEmail = data.email
  if (typeof rawEmail !== 'string' || !rawEmail.trim()) return
  const email = normalizeEmail(rawEmail)

  const existing = await req.payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const doc = existing.docs[0] as ExistingUserForAttach | undefined
  if (!doc?.id) return

  const tenantId = extractTenantId(await resolveTenantIdForUserCreate(data, req))

  if (tenantId == null) {
    throw new ValidationError({
      errors: [
        {
          path: 'email',
          message:
            'This email already has an account. Select a tenant in the sidebar, then try again to add them to your organization.',
        },
      ],
    })
  }

  const adminTenantIds = isAdmin(req.user)
    ? []
    : await resolveOrgAdminTenantIds({
        user: req.user,
        payload: req.payload,
        context: req.context as Record<string, unknown> | undefined,
      })

  if (!isAdmin(req.user)) {
    const membershipIds = getTenantMembershipIdsFromUserDoc(req.user)
    const allowed = adminTenantIds.length > 0 ? adminTenantIds : membershipIds
    if (!allowed.includes(tenantId)) {
      throw new APIError('You cannot add users to a tenant you do not administer.', 403)
    }
  }

  // Location-managers are not org admins and cannot grant roles. Org admins may
  // copy the roles they submitted for a tenant they administer.
  const roles =
    isAdmin(req.user) || adminTenantIds.includes(tenantId)
      ? rolesForTenantFromCreateData(data, tenantId)
      : ['user']

  // The read stays on this request. The membership update commits separately:
  // the ValidationError below aborts the create and would roll the membership back.
  const result = await attachUserToTenant({
    payload: req.payload,
    doc,
    tenantId,
    roles,
    req,
  })

  if (result.alreadyMember) {
    throw new ValidationError({
      errors: [
        {
          path: 'email',
          message:
            'This email already belongs to someone in your organization. Open the users list to find them.',
        },
      ],
    })
  }

  throw new ValidationError({
    errors: [
      {
        path: 'email',
        message:
          'This person already has an account and has been added to your organization. Return to the users list to find them.',
      },
    ],
  })
}
