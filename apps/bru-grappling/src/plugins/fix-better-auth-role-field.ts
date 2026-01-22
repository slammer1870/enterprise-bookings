import type { CollectionConfig, Config, Plugin } from 'payload'

/**
 * Fix for `payload-auth/better-auth` role field schema mismatch.
 *
 * The better-auth plugin may add the `role` field in a way that causes Payload to
 * treat it as a `hasMany` field (creating a junction table), when it should be
 * a simple enum column on the `users` table.
 *
 * This plugin ensures the `role` field is correctly defined as a simple select
 * field (not hasMany) after better-auth adds it.
 */
export const fixBetterAuthRoleField = (): Plugin => (incomingConfig: Config): Config => {
  const config = { ...incomingConfig }

  const collections = config.collections || []
  const usersCollection = collections.find((c) => c.slug === 'users')

  if (!usersCollection) {
    return config
  }

  const fields = usersCollection.fields || []
  
  // Find and fix the role field
  const fixedFields = fields.map((field) => {
    if ('name' in field && field.name === 'role') {
      // Ensure role is a simple select field, not hasMany
      // Use type assertion since we're modifying the field structure
      return {
        ...(field as any),
        type: 'select' as const,
        hasMany: false, // Explicitly set to false to prevent junction table
      }
    }
    return field
  }) as typeof fields

  // If role field doesn't exist, add it (shouldn't happen, but defensive)
  const hasRoleField = fixedFields.some((field) => 'name' in field && field.name === 'role')
  if (!hasRoleField) {
    fixedFields.unshift({
      name: 'role',
      type: 'select',
      options: ['user', 'admin'],
      defaultValue: 'user',
      required: true,
    })
  }

  const patched: CollectionConfig = {
    ...usersCollection,
    fields: fixedFields,
  }

  config.collections = [
    ...collections.filter((c) => c.slug !== 'users'),
    patched,
  ]

  return config
}
