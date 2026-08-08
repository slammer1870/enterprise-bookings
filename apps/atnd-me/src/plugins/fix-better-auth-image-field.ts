import type { CollectionConfig, Config, Field, Plugin, UploadField } from 'payload'

import { isAdmin, isTenantAdmin } from '@/access/userTenantAccess'

/**
 * Convert Better Auth's text `image` field into a real media upload.
 * Google OAuth may still try to write a profile URL string — strip those so they
 * do not overwrite / fail validation against the upload field.
 */
export const fixBetterAuthImageField = (): Plugin => (incomingConfig: Config): Config => {
  const config = { ...incomingConfig }
  const collections = config.collections || []
  const usersCollection = collections.find((c) => c.slug === 'users')

  if (!usersCollection) {
    return config
  }

  const imageUpload: UploadField = {
    name: 'image',
    label: 'Image',
    type: 'upload',
    relationTo: 'media',
    required: false,
    saveToJWT: false,
    admin: {
      position: 'sidebar',
      description: 'Public schedule / event host photo (selectable media).',
    },
    access: {
      read: () => true,
      update: ({ req: { user } }) =>
        Boolean(user && (isAdmin(user) || isTenantAdmin(user))),
    },
    custom: {
      betterAuthFieldKey: 'image',
    },
  }

  const fields = (usersCollection.fields || []).map((field): Field => {
    if ('name' in field && field.name === 'image') {
      return {
        ...imageUpload,
        // Preserve any custom markers from Better Auth / prior plugins.
        custom: {
          ...(('custom' in field && field.custom && typeof field.custom === 'object'
            ? field.custom
            : {}) as Record<string, unknown>),
          betterAuthFieldKey: 'image',
        },
      }
    }
    return field
  })

  // If Better Auth somehow omitted `image`, still ensure the upload exists.
  const hasImage = fields.some((f) => 'name' in f && f.name === 'image')
  const fieldsWithImage = hasImage ? fields : [...fields, imageUpload]

  const existingBeforeChange = usersCollection.hooks?.beforeChange ?? []
  const patched: CollectionConfig = {
    ...usersCollection,
    fields: fieldsWithImage,
    hooks: {
      ...usersCollection.hooks,
      beforeChange: [
        ...existingBeforeChange,
        ({ data }) => {
          if (!data) return data
          // Better Auth / Google may pass a profile URL string — ignore it.
          if (typeof (data as { image?: unknown }).image === 'string') {
            delete (data as { image?: unknown }).image
          }
          return data
        },
      ],
    },
  }

  config.collections = [...collections.filter((c) => c.slug !== 'users'), patched]
  return config
}
