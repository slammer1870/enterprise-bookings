import type { CollectionBeforeValidateHook, CollectionConfig, Config, Plugin } from 'payload'

/**
 * Fix for `payload-auth/better-auth` timestamp validation during auth flows.
 *
 * Some Better Auth plugin collections (e.g. `sessions`) can require `updatedAt`/`createdAt`
 * during validation, but these fields are not always present in the incoming `data` yet,
 * causing errors like:
 *   - "The following field is invalid: Updated At" (collection: sessions, path: updatedAt)
 *
 * This plugin injects a `beforeValidate` hook into the Better Auth collections to ensure
 * timestamps are always populated.
 */
export const fixBetterAuthTimestamps =
  (
    slugs: string[] = ['accounts', 'sessions', 'verifications', 'admin_invitations']
  ): Plugin =>
  (incomingConfig: Config): Config => {
    const config = { ...incomingConfig }

    const ensureTimestamps: CollectionBeforeValidateHook = async ({ data, operation }) => {
      if (!data) return data

      const now = new Date()

      // On create, ensure both exist.
      if (operation === 'create') {
        if ((data as any).createdAt == null) (data as any).createdAt = now
        if ((data as any).updatedAt == null) (data as any).updatedAt = now
      }

      // On update, always refresh updatedAt.
      if (operation === 'update') {
        ;(data as any).updatedAt = now
      }

      return data
    }

    const collections = config.collections || []

    // Patch each Better Auth collection that exists in this app's config.
    for (const slug of slugs) {
      const collection = collections.find((c) => c.slug === slug)
      if (!collection) continue

      const existingHooks = collection.hooks || {}
      const existingBeforeValidate = existingHooks.beforeValidate || []

      const patched: CollectionConfig = {
        ...collection,
        hooks: {
          ...existingHooks,
          // Run our hook first so validation always sees timestamps.
          beforeValidate: [ensureTimestamps, ...existingBeforeValidate],
        },
      }

      config.collections = [
        ...(config.collections || []).filter((c) => c.slug !== slug),
        patched,
      ]
    }

    return config
  }

