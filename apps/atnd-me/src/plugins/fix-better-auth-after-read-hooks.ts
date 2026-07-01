import type { CollectionConfig, Config, Plugin } from 'payload'

import { isAdmin } from '@/access/userTenantAccess'
import { resolveTenantAdminTenantIds } from '@/access/tenant-scoped'
import { filterTenantsForTenantAdmin } from '@/collections/Users/tenantHookHelpers'

/**
 * Restores the Users collection `afterRead` hook that is silently dropped by the
 * payload-auth (Better Auth) plugin.
 *
 * Why: Better Auth rebuilds the Users collection hooks object and only re-merges
 * `beforeChange`, `afterChange`, `beforeLogin`, `afterLogin`, `afterLogout`, and
 * `beforeDelete`. Any `afterRead` hooks defined on the Users collection are lost.
 *
 * This plugin runs after Better Auth and appends the tenant-privacy afterRead hook
 * directly onto the final collection config so it always executes.
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
      req: { user?: unknown; payload: { findByID: unknown; find: unknown; [key: string]: unknown }; context?: Record<string, unknown> | undefined }
    }): Promise<Record<string, unknown>> => {
      if (!req.user) return doc
      if (isAdmin(req.user)) return doc // super-admin: see everything

      // Do NOT use isTenantAdmin(req.user) as a gate here: session/JWT users and users
      // created via the Local API with overrideAccess:true may have their `role` field
      // stripped by field-level access control (fixBetterAuthRoleField plugin). Instead,
      // let resolveTenantAdminTenantIds be the single source of truth — it loads the full
      // user doc from DB (with overrideAccess:true) and checks tenants[n].roles directly.
      const adminTenantIds = await resolveTenantAdminTenantIds({
        user: req.user,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload: req.payload as any,
        context: req.context,
      })

      if (adminTenantIds.length === 0) return doc // not a tenant admin; return as-is

      return filterTenantsForTenantAdmin({ doc, adminTenantIds })
    }

    const patched: CollectionConfig = {
      ...usersCollection,
      hooks: {
        ...usersCollection.hooks,
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
