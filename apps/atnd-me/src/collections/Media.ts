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
} from '../access/tenant-scoped'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const Media: CollectionConfig = {
  slug: 'media',
  folders: false,
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
    read: tenantScopedMediaRead,
    create: tenantScopedCreate,
    update: tenantScopedUpdate,
    delete: tenantScopedDelete,
  },
  hooks: {
    beforeValidate: [
      ({ data, req, operation }) => {
        if (operation !== 'create') return data
        if (!data) return data
        if (data.tenant) return data

        const rawTenant = req.context?.tenant
        if (!rawTenant) return data

        const id =
          typeof rawTenant === 'object' && rawTenant !== null && 'id' in rawTenant
            ? (rawTenant as { id: number }).id
            : rawTenant
        if (typeof id === 'number') {
          data.tenant = id
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
  ],
  upload: {
    // Upload to the public/media directory in Next.js making them publicly accessible even outside of Payload
    staticDir: path.resolve(dirname, '../../public/media'),
    adminThumbnail: 'thumbnail',
    focalPoint: true,
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
