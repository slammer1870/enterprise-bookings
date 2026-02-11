import type { CollectionConfig } from 'payload'

import {
  tenantScopedCreate,
  tenantScopedUpdate,
  tenantScopedDelete,
  tenantScopedReadFiltered,
} from '../../access/tenant-scoped'
import { defaultBlockSlugs } from '../../blocks/registry'
import { getBlocksForTenant } from '../../utilities/getBlocksForTenant'
import { Hero, About, Location, Faqs, createThreeColumnLayout } from '@repo/website'
import { Archive } from '../../blocks/ArchiveBlock/config'
import { CallToAction } from '../../blocks/CallToAction/config'
import { Content } from '../../blocks/Content/config'
import { FormBlock } from '../../blocks/Form/config'
import { MediaBlock } from '../../blocks/MediaBlock/config'
import { HealthBenefits } from '@/blocks/HealthBenefits/config'
import { HeroSchedule } from '@/blocks/HeroSchedule/config'
import { HeroScheduleSanctuary } from '@/blocks/HeroScheduleSanctuary/config'
import { Schedule } from '@/blocks/Schedule/config'
import { SectionTagline } from '@/blocks/SectionTagline/config'
import { populatePublishedAt } from '../../hooks/populatePublishedAt'
import { generatePreviewPath } from '../../utilities/generatePreviewPath'
import { revalidateDelete, revalidatePage } from './hooks/revalidatePage'
import { tenantScopedSlugField } from '../../fields/tenant-scoped-slug-field'

import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'

// Define all available blocks for the pages collection (used for block schemas + filterOptions)
const availableBlocks = [
  HeroSchedule,
  HeroScheduleSanctuary,
  Hero,
  About,
  Location,
  Schedule,
  HealthBenefits,
  SectionTagline,
  Faqs,
  CallToAction,
  Content,
  MediaBlock,
  Archive,
  FormBlock,
]

// Create the three column layout block - automatically uses all blocks from the pages config
const ThreeColumnLayout = createThreeColumnLayout(availableBlocks)

/** Extract allowed block slugs for a tenant (from form data or req context). */
function getAllowedBlockSlugs(data: { tenant?: unknown }, req?: { context?: { tenant?: unknown } }): string[] {
  const tenant = data?.tenant ?? req?.context?.tenant
  if (!tenant) return defaultBlockSlugs
  const allowed = typeof tenant === 'object' && tenant !== null && 'allowedBlocks' in tenant
    ? (tenant as { allowedBlocks?: string[] }).allowedBlocks
    : undefined
  return getBlocksForTenant(allowed ?? []).map((b) => b.slug!).filter(Boolean)
}

export const Pages: CollectionConfig<'pages'> = {
  slug: 'pages',
  access: {
    read: tenantScopedReadFiltered,
    create: tenantScopedCreate,
    update: tenantScopedUpdate,
    delete: tenantScopedDelete,
  },
  // This config controls what's populated by default when a page is referenced
  // https://payloadcms.com/docs/queries/select#defaultpopulate-collection-config-property
  // Type safe if the collection slug generic is passed to `CollectionConfig` - `CollectionConfig<'pages'>
  defaultPopulate: {
    title: true,
    slug: true,
    tenant: true, // Populate tenant (incl. allowedBlocks) for tenant-scoped block filterOptions
  },
  admin: {
    group: 'Website',
    defaultColumns: ['title', 'slug', 'updatedAt'],
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          slug: data?.slug,
          collection: 'pages',
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: data?.slug as string,
        collection: 'pages',
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
      type: 'tabs',
      tabs: [
        {
          fields: [
            {
              name: 'layout',
              type: 'blocks',
              blocks: [
                HeroSchedule,
                HeroScheduleSanctuary,
                Hero,
                ThreeColumnLayout,
                ...availableBlocks.filter(
                  (block) =>
                    block.slug !== 'heroSchedule' &&
                    block.slug !== 'heroScheduleSanctuary' &&
                    block.slug !== 'hero'
                ),
              ],
              filterOptions: ({ data, req }) => {
                const allowed = getAllowedBlockSlugs(data ?? {}, req)
                return allowed
              },
              required: true,
              admin: {
                description: 'Add blocks to build your page. Blocks available depend on your tenant settings.',
              },
            },
          ],
          label: 'Content',
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
        position: 'sidebar',
      },
    },
    tenantScopedSlugField({ fieldToUse: 'title' }),
  ],
  hooks: {
    afterChange: [revalidatePage],
    beforeChange: [
      populatePublishedAt,
      async ({ data, req, operation }) => {
        if (!data?.layout || !Array.isArray(data.layout)) return data
        const tenantId =
          typeof data.tenant === 'object' && data.tenant !== null && 'id' in data.tenant
            ? (data.tenant as { id: number }).id
            : data.tenant
        if (!tenantId) return data
        const id = typeof tenantId === 'object' && tenantId !== null && 'id' in tenantId
          ? (tenantId as { id: number }).id
          : tenantId
        const tenant = await req.payload.findByID({
          collection: 'tenants',
          id: id as number,
          depth: 0,
        })
        const allowed = getBlocksForTenant(
          (tenant as { allowedBlocks?: string[] })?.allowedBlocks
        ).map((b) => b.slug)
        const disallowed = data.layout
          .map((b: { blockType?: string }) => b?.blockType)
          .filter((slug: string | undefined) => slug && !allowed.includes(slug))
        if (disallowed.length > 0) {
          throw new Error(
            `The following blocks are not enabled for this tenant: ${disallowed.join(', ')}. Contact your administrator to enable them.`
          )
        }
        return data
      },
    ],
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
