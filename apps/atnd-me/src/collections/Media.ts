import type { CollectionConfig } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedMediaRead,
  tenantScopedUpdate,
  resolveTenantIdFromRequest,
} from '../access/tenant-scoped'
import { isStaffOnlyUser, tenantOrgPayloadAdminAccess } from '../access/userTenantAccess'
import {
  getMediaUploadSizeError,
  MEDIA_MAX_FILE_SIZE_BYTES,
} from '../lib/media/upload-limits'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const Media: CollectionConfig = {
  slug: 'media',
  folders: false,
  admin: {
    components: {
      edit: {
        // Client-side size check + max-size hint (server limit alone leaves admin "loading")
        Upload: '@/components/admin/MediaUpload',
      },
    },
  },
  // Ensure relationship population includes fields needed by the frontend.
  // In particular `updatedAt` is used as a cache-busting tag in `getMediaUrl(...)`.
  defaultPopulate: {
    alt: true,
    isPublic: true,
    updatedAt: true,
    createdAt: true,
    url: true,
    filename: true,
    mimeType: true,
    filesize: true,
    width: true,
    height: true,
    focalX: true,
    focalY: true,
    sizes: true,
  },
  access: {
    admin: tenantOrgPayloadAdminAccess,
    read: tenantScopedMediaRead,
    create: async (args) => {
      if (isStaffOnlyUser(args.req.user)) return false
      return tenantScopedCreate(args)
    },
    update: async (args) => {
      if (isStaffOnlyUser(args.req.user)) return false
      return tenantScopedUpdate(args)
    },
    delete: async (args) => {
      if (isStaffOnlyUser(args.req.user)) return false
      return tenantScopedDelete(args)
    },
  },
  hooks: {
    beforeValidate: [
      async ({ data, req, operation }) => {
        if (operation !== 'create') return data
        if (!data) return data
        if (data.tenant) return data

        const rawTenant = req.context?.tenant
        const resolved: unknown = rawTenant
          ? // Preferred: tenant already resolved into Payload request context
            typeof rawTenant === 'object' && rawTenant !== null && 'id' in rawTenant
            ? (rawTenant as { id: unknown }).id
            : rawTenant
          : // Fallback: resolve tenant from host/cookies (fixes block-triggered uploads)
            await resolveTenantIdFromRequest(req as any)

        if (typeof resolved === 'number' && Number.isFinite(resolved)) {
          data.tenant = resolved
        } else if (typeof resolved === 'string' && resolved !== '') {
          data.tenant = resolved
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'isPublic',
      type: 'checkbox',
      defaultValue: false,
      access: {
        create: () => false,
        update: () => false,
      },
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'alt',
      type: 'text',
      //required: true,
    },
    {
      name: 'caption',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()]
        },
      }),
    },
    // Override built-in filesize so Local API creates also enforce the same cap as
    // payload.config upload.limits.fileSize (multipart is already handled there).
    {
      name: 'filesize',
      type: 'number',
      admin: {
        readOnly: true,
        disabled: true,
      },
      validate: (value: unknown) => {
        if (typeof value === 'number' && value > MEDIA_MAX_FILE_SIZE_BYTES) {
          return getMediaUploadSizeError()
        }
        return true
      },
    },
  ],
  upload: {
    // Upload to the public/media directory in Next.js making them publicly accessible even outside of Payload
    staticDir: path.resolve(dirname, '../../public/media'),
    adminThumbnail: 'thumbnail',
    focalPoint: true,
    mimeTypes: ['image/*'],
    imageSizes: [
      {
        name: 'thumbnail',
        width: 300,
      },
      {
        name: 'square',
        width: 500,
        height: 500,
      },
      {
        name: 'small',
        width: 600,
      },
      {
        name: 'medium',
        width: 900,
      },
      {
        name: 'large',
        width: 1400,
      },
      {
        name: 'xlarge',
        width: 1920,
      },
      {
        name: 'og',
        width: 1200,
        height: 630,
        crop: 'center',
      },
    ],
  },
}
