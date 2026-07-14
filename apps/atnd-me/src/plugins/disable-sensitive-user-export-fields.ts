import type { CollectionConfig, Config, Field, Plugin } from 'payload'

const USERS_SENSITIVE_EXPORT_FIELDS = new Set([
  'hash',
  'salt',
  'resetPasswordToken',
  'resetPasswordExpiration',
  'loginAttempts',
  'lockUntil',
  'sessions',
])

const ACCOUNTS_SENSITIVE_EXPORT_FIELDS = new Set([
  'accessToken',
  'refreshToken',
  'idToken',
  'password',
])

const SESSIONS_SENSITIVE_EXPORT_FIELDS = new Set(['token'])

function disableFieldForImportExport(field: Field, sensitiveNames: Set<string>): Field {
  const next = { ...field } as Field

  if ('name' in next && typeof next.name === 'string' && sensitiveNames.has(next.name)) {
    return {
      ...next,
      custom: {
        ...(next.custom ?? {}),
        'plugin-import-export': {
          ...(next.custom?.['plugin-import-export'] ?? {}),
          disabled: true,
        },
      },
    } as Field
  }

  if ('fields' in next && Array.isArray(next.fields)) {
    return {
      ...next,
      fields: next.fields.map((child) => disableFieldForImportExport(child, sensitiveNames)),
    } as Field
  }

  return next
}

function patchCollectionFields(
  collection: CollectionConfig,
  sensitiveNames: Set<string>,
): CollectionConfig {
  return {
    ...collection,
    fields: (collection.fields ?? []).map((field) =>
      disableFieldForImportExport(field, sensitiveNames),
    ),
  }
}

/**
 * Exclude credential and session secrets from CSV/JSON exports.
 */
export const disableSensitiveUserExportFields = (): Plugin => (incomingConfig: Config): Config => {
  const config = { ...incomingConfig }
  const collections = config.collections ?? []

  const patched = collections.map((collection) => {
    if (collection.slug === 'users') {
      return patchCollectionFields(collection, USERS_SENSITIVE_EXPORT_FIELDS)
    }

    if (collection.slug === 'accounts') {
      return patchCollectionFields(collection, ACCOUNTS_SENSITIVE_EXPORT_FIELDS)
    }

    if (collection.slug === 'sessions') {
      return patchCollectionFields(collection, SESSIONS_SENSITIVE_EXPORT_FIELDS)
    }

    return collection
  })

  config.collections = patched
  return config
}
