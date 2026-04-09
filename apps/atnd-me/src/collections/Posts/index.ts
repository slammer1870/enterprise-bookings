import type { CollectionConfig, Where } from 'payload'

import {
  BlocksFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

import type { User as SharedUser } from '@repo/shared-types'
import { checkRole } from '@repo/shared-utils'

import { postsCreate, postsDelete, postsRead, postsUpdate } from '../../access/postsAccess'
import {
  getUserTenantIds,
  resolveTenantIdFromRequest,
  type RequestLike,
} from '../../access/tenant-scoped'
import { tenantScopedSlugField } from '../../fields/tenant-scoped-slug-field'
import { Banner } from '../../blocks/Banner/config'
import { Code } from '../../blocks/Code/config'
import { MediaBlock } from '../../blocks/MediaBlock/config'
import { generatePreviewPath } from '../../utilities/generatePreviewPath'
import { populateAuthors } from './hooks/populateAuthors'
import { revalidateDelete, revalidatePost } from './hooks/revalidatePost'

import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'
export const Posts: CollectionConfig<'posts'> = {
  slug: 'posts',
  access: {
    admin: ({ req: { user } }) => {
      if (!user) return false
      return checkRole(['super-admin', 'admin', 'staff'], user as unknown as SharedUser)
    },
    create: postsCreate,
    delete: postsDelete,
    read: postsRead,
    update: postsUpdate,
  },
  // This config controls what's populated by default when a post is referenced
  // https://payloadcms.com/docs/queries/select#defaultpopulate-collection-config-property
  // Type safe if the collection slug generic is passed to `CollectionConfig` - `CollectionConfig<'posts'>
  defaultPopulate: {
    title: true,
    slug: true,
    tenant: true,
    categories: true,
    meta: {
      image: true,
      description: true,
    },
  },
  admin: {
    group: 'Website',
    description: 'Blog posts. Assign a tenant so the article appears on that site; leave tenant empty for platform-wide posts on the root domain only.',
    defaultColumns: ['title', 'slug', 'tenant', 'updatedAt'],
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          slug: data?.slug,
          collection: 'posts',
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: data?.slug as string,
        collection: 'posts',
        req,
      }),
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: false,
      index: true,
      label: 'Assigned tenant',
      admin: {
        position: 'sidebar',
        description:
          'Optional. Leave empty for posts on the main platform domain only. Set for tenant blog content.',
      },
      filterOptions: ({ req }) => {
        const tenantIds = getUserTenantIds((req.user ?? null) as unknown as SharedUser | null)
        if (tenantIds === null) return true
        if (Array.isArray(tenantIds) && tenantIds.length > 0) {
          return { id: { in: tenantIds } }
        }
        return true
      },
    },
    {
      name: '_tenantSelectorSync',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '@repo/plugin-clearable-tenant/client#SyncTenantSelectorToFormField',
        },
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          fields: [
            {
              name: 'heroImage',
              type: 'upload',
              relationTo: 'media',
            },
            {
              name: 'content',
              type: 'richText',
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                    BlocksFeature({ blocks: [Banner, Code, MediaBlock] }),
                    FixedToolbarFeature(),
                    InlineToolbarFeature(),
                    HorizontalRuleFeature(),
                  ]
                },
              }),
              label: false,
              required: true,
            },
          ],
          label: 'Content',
        },
        {
          fields: [
            {
              name: 'relatedPosts',
              type: 'relationship',
              admin: {
                position: 'sidebar',
              },
              filterOptions: ({ data, id }) => {
                const selfId = id != null ? [id] : []
                const t = data?.tenant as unknown
                const tenantId =
                  typeof t === 'object' && t !== null && 'id' in t
                    ? (t as { id: number }).id
                    : typeof t === 'number'
                      ? t
                      : typeof t === 'string' && /^\d+$/.test(t)
                        ? parseInt(t, 10)
                        : null

                const clauses: Where[] = []
                if (selfId.length) {
                  clauses.push({ id: { not_in: selfId } })
                }
                if (tenantId != null && Number.isFinite(tenantId)) {
                  clauses.push({ tenant: { equals: tenantId } })
                } else {
                  clauses.push({ tenant: { equals: null } })
                }
                if (clauses.length === 1) {
                  return clauses[0] as Where
                }
                return { and: clauses } satisfies Where
              },
              hasMany: true,
              relationTo: 'posts',
            },
            {
              name: 'categories',
              type: 'relationship',
              admin: {
                position: 'sidebar',
              },
              hasMany: true,
              relationTo: 'categories',
            },
          ],
          label: 'Meta',
        },
        {
          name: 'meta',
          label: 'SEO',
          fields: [
            OverviewField({
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
              imagePath: 'meta.image',
            }),
            MetaTitleField({
              hasGenerateFn: true,
            }),
            MetaImageField({
              relationTo: 'media',
            }),

            MetaDescriptionField({}),
            PreviewField({
              // if the `generateUrl` function is configured
              hasGenerateFn: true,

              // field paths to match the target field for data
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
            }),
          ],
        },
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        position: 'sidebar',
      },
      hooks: {
        beforeChange: [
          ({ siblingData, value }) => {
            if (siblingData._status === 'published' && !value) {
              return new Date()
            }
            return value
          },
        ],
      },
    },
    {
      name: 'authors',
      type: 'relationship',
      admin: {
        position: 'sidebar',
      },
      hasMany: true,
      relationTo: 'users',
    },
    // This field is only used to populate the user data via the `populateAuthors` hook
    // This is because the `user` collection has access control locked to protect user privacy
    // GraphQL will also not return mutated user data that differs from the underlying schema
    {
      name: 'populatedAuthors',
      type: 'array',
      access: {
        update: () => false,
      },
      admin: {
        disabled: true,
        readOnly: true,
      },
      fields: [
        {
          name: 'id',
          type: 'text',
        },
        {
          name: 'name',
          type: 'text',
        },
      ],
    },
    tenantScopedSlugField({ fieldToUse: 'title', collection: 'posts' }),
  ],
  hooks: {
    beforeValidate: [
      async ({ data, operation, req, originalDoc }) => {
        if (!data) return data
        if (data.tenant === null) return data
        if (data.tenant) return data

        const tid = await resolveTenantIdFromRequest(req as RequestLike)
        if (tid != null) {
          data.tenant = tid
          return data
        }

        if (operation === 'update' && originalDoc?.tenant) {
          data.tenant =
            typeof originalDoc.tenant === 'object' && originalDoc.tenant !== null && 'id' in originalDoc.tenant
              ? (originalDoc.tenant as { id: number }).id
              : originalDoc.tenant
        }
        return data
      },
      async ({ data, operation, req, originalDoc }) => {
        if (!data || !req.user) return data
        if (checkRole(['super-admin'], req.user as unknown as SharedUser)) return data
        if (!checkRole(['admin', 'staff'], req.user as unknown as SharedUser)) return data

        const tenantIdFromValue = (raw: unknown): number | null => {
          if (raw === null || raw === undefined || raw === '') return null
          if (typeof raw === 'number' && Number.isFinite(raw)) return raw
          if (typeof raw === 'string' && /^\d+$/.test(raw)) return parseInt(raw, 10)
          if (typeof raw === 'object' && raw !== null && 'id' in raw) {
            const rid = (raw as { id: unknown }).id
            if (typeof rid === 'number' && Number.isFinite(rid)) return rid
            if (typeof rid === 'string' && /^\d+$/.test(rid)) return parseInt(rid, 10)
          }
          return null
        }

        if (operation === 'create' && tenantIdFromValue(data.tenant) == null) {
          throw new Error(
            'Assign a tenant to create a post. Platform-wide posts require a super-admin account.',
          )
        }

        if (
          operation === 'update' &&
          originalDoc &&
          Object.prototype.hasOwnProperty.call(data, 'tenant') &&
          tenantIdFromValue(data.tenant) == null &&
          originalDoc.tenant != null
        ) {
          const ot = originalDoc.tenant
          data.tenant =
            typeof ot === 'object' && ot !== null && 'id' in ot ? (ot as { id: number }).id : ot
        }
        return data
      },
    ],
    afterChange: [revalidatePost],
    afterRead: [populateAuthors],
    afterDelete: [revalidateDelete],
  },
  versions: {
    drafts: {
      autosave: {
        interval: 100, // We set this interval for optimal live preview
      },
      schedulePublish: true,
    },
    maxPerDoc: 50,
  },
}
