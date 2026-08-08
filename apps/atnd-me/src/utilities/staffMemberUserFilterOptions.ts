import type { Where } from 'payload'

import { getPayloadTenantIdFromRequest } from '@/utilities/tenantRequest'
import { cookiesFromHeaders } from '@/utilities/cookiesFromHeaders'
import { isAdmin } from '@/access/userTenantAccess'

const ELEVATED_TENANT_ROLES = ['admin', 'staff', 'location-manager'] as const

/**
 * Timeslot / scheduler Staff Member relationship → users.
 * Prefer users with elevated roles on the current admin tenant (`payload-tenant`).
 */
export function staffMemberUserFilterOptions(args: {
  req?: {
    user?: unknown
    headers?: Headers
    cookies?: { get: (name: string) => { value?: string } | undefined }
  }
}): Where | true {
  const req = args.req
  const cookieSrc = {
    cookies: mergeCookies(req),
    headers: req?.headers,
  }
  const tenantId = getPayloadTenantIdFromRequest(cookieSrc)

  if (tenantId != null) {
    return {
      and: [
        { 'tenants.tenant': { equals: tenantId } },
        { 'tenants.roles': { in: [...ELEVATED_TENANT_ROLES] } },
      ],
    }
  }

  // Super-admin with no tenant selected: any elevated global role
  if (req?.user && isAdmin(req.user)) {
    return {
      role: { in: ['super-admin', 'admin', 'staff', 'location-manager'] },
    }
  }

  return true
}

function mergeCookies(req?: {
  headers?: Headers
  cookies?: { get: (name: string) => { value?: string } | undefined }
}): { get: (name: string) => { value?: string } | undefined } | undefined {
  if (!req) return undefined
  if (req.cookies?.get) return req.cookies
  if (req.headers) {
    try {
      return cookiesFromHeaders(req.headers)
    } catch {
      return undefined
    }
  }
  return undefined
}
