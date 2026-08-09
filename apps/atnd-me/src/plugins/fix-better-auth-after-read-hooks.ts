import type {
  CollectionBeforeValidateHook,
  CollectionConfig,
  Config,
  Plugin,
} from 'payload'

import { isAdmin } from '@/access/userTenantAccess'
import { resolveOrgAdminTenantIds } from '@/access/tenant-scoped'
import { filterTenantsForTenantAdmin } from '@/collections/Users/tenantHookHelpers'
import { assertAnonymousUserCreateRateLimit } from '@/collections/Users/sanitizeUserWrite'
import { stripForeignTenantsBeforeValidate } from '@/collections/Users/stripForeignTenantsBeforeValidate'
import {
  markPasswordResetOperation,
  preserveTenantsOnPasswordReset,
} from '@/collections/Users/preserveTenantsOnPasswordReset'

/**
 * Restores Users collection hooks silently dropped by the payload-auth (Better Auth) plugin.
 *
 * Why: Better Auth rebuilds the Users collection hooks object and only re-merges
 * `beforeChange`, `afterChange`, `beforeLogin`, `afterLogin`, `afterLogout`, and
 * `beforeDelete`. Hooks such as `afterRead`, `beforeValidate`, and `beforeOperation`
 * defined on the Users collection are lost.
 *
 * This plugin runs after Better Auth and re-attaches the missing hooks.
 */
export const fixBetterAuthAfterReadHooks = (): Plugin =>
  (incomingConfig: Config): Config => {
    const config = { ...incomingConfig }
    const collections = config.collections || []
    const usersCollection = collections.find((c) => c.slug === 'users')

    if (!usersCollection) {
      return config
    }

    const tenantFilterAfterRead = async ({
      doc,
      req,
    }: {
      doc: Record<string, unknown>
      req: {
        user?: unknown
        payload: { findByID: unknown; find: unknown; [key: string]: unknown }
        context?: Record<string, unknown> | undefined
      }
    }): Promise<Record<string, unknown>> => {
      if (!req.user) return doc
      if (isAdmin(req.user)) return doc // super-admin: see everything

      // Do NOT use isTenantAdmin(req.user) as a gate here: session/JWT users and users
      // created via the Local API with overrideAccess:true may have their `role` field
      // stripped by field-level access control (fixBetterAuthRoleField plugin). Instead,
      // Orgs this user administers only (not staff/customer memberships elsewhere).
      const adminTenantIds = await resolveOrgAdminTenantIds({
        user: req.user,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload: req.payload as any,
        context: req.context,
      })

      if (adminTenantIds.length === 0) return doc // not a tenant admin; return as-is

      return filterTenantsForTenantAdmin({ doc, adminTenantIds })
    }

    const stripForeignTenantsHook: CollectionBeforeValidateHook = async ({ data, req }) =>
      stripForeignTenantsBeforeValidate({
        data: data as Record<string, unknown> | null | undefined,
        req,
      })

    const patched: CollectionConfig = {
      ...usersCollection,
      hooks: {
        ...usersCollection.hooks,
        beforeOperation: [
          ...(usersCollection.hooks?.beforeOperation ?? []),
          async ({ args, operation, req }) => {
            if (operation === 'create') {
              assertAnonymousUserCreateRateLimit(req)
            }
            return args
          },
          // Flag resetPassword so beforeValidate can strip array fields safely.
          markPasswordResetOperation,
        ],
        beforeValidate: [
          ...(usersCollection.hooks?.beforeValidate ?? []),
          stripForeignTenantsHook,
          // Strip tenants/locations before raw db.updateOne in resetPasswordOperation
          // (bypasses beforeChange). See preserveTenantsOnPasswordReset.ts.
          preserveTenantsOnPasswordReset,
        ],
        afterRead: [
          ...(usersCollection.hooks?.afterRead ?? []),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tenantFilterAfterRead as any,
        ],
      },
    }

    config.collections = [...collections.filter((c) => c.slug !== 'users'), patched]
    return config
  }
