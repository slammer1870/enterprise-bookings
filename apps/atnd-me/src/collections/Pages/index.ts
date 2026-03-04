import type { CollectionConfig } from 'payload'

import type { User as SharedUser } from '@repo/shared-types'
import { checkRole } from '@repo/shared-utils'
import {
  tenantScopedCreate,
  tenantScopedUpdate,
  tenantScopedDelete,
  tenantScopedReadFiltered,
} from '../../access/tenant-scoped'
import { defaultBlockSlugs } from '../../blocks/registry'
import { getBlocksForTenant } from '../../utilities/getBlocksForTenant'
import {
  Hero,
  About,
  Location,
  Faqs,
  createThreeColumnLayout,
  MarketingHero,
  Features,
  CaseStudies,
  MarketingCta,
} from '@repo/website'
import { Archive } from '../../blocks/ArchiveBlock/config'
import { CallToAction } from '../../blocks/CallToAction/config'
import { Content } from '../../blocks/Content/config'
import { FormBlock } from '../../blocks/Form/config'
import { MediaBlock } from '../../blocks/MediaBlock/config'
import { HealthBenefits } from '@/blocks/HealthBenefits/config'
import { HeroSchedule } from '@/blocks/HeroSchedule/config'
import { HeroScheduleSanctuary } from '@/blocks/HeroScheduleSanctuary/config'
import { HeroWithLocation } from '@/blocks/HeroWithLocation/config'
import { Schedule } from '@/blocks/Schedule/config'
import { TenantScopedSchedule } from '@/blocks/TenantScopedSchedule/config'
import { SectionTagline } from '@/blocks/SectionTagline/config'
import { populatePublishedAt } from '../../hooks/populatePublishedAt'
import { generatePreviewPath } from '../../utilities/generatePreviewPath'
import { revalidateDelete, revalidatePage } from './hooks/revalidatePage'
import { tenantScopedSlugField } from '../../fields/tenant-scoped-slug-field'
import { getUserTenantIds } from '../../access/tenant-scoped'

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
  HeroWithLocation,
  Hero,
  MarketingHero,
  About,
  Location,
  Schedule,
  TenantScopedSchedule,
  HealthBenefits,
  SectionTagline,
  Faqs,
  Features,
  CaseStudies,
  CallToAction,
  MarketingCta,
  Content,
  MediaBlock,
  Archive,
  FormBlock,
]

// Create the three column layout block - automatically uses all blocks from the pages config
const ThreeColumnLayout = createThreeColumnLayout(availableBlocks)

const pageBlocks = [
  HeroSchedule,
  HeroScheduleSanctuary,
  HeroWithLocation,
  Hero,
  MarketingHero,
  ThreeColumnLayout,
  ...availableBlocks.filter(
    (block) =>
      block.slug !== 'heroSchedule' &&
      block.slug !== 'heroScheduleSanctuary' &&
      block.slug !== 'heroWithLocation' &&
      block.slug !== 'hero' &&
      block.slug !== 'marketingHero'
  ),
]

const allPageBlockSlugs: string[] = pageBlocks.map((b) => b.slug!).filter(Boolean)

/** Extract allowed block slugs from the document's tenant only (not navbar context). Base pages get default blocks. */
function _getAllowedBlockSlugs(data: { tenant?: unknown }, _req?: { context?: { tenant?: unknown } }): string[] {
  const tenant = data?.tenant
  if (!tenant) return defaultBlockSlugs
  const allowed = typeof tenant === 'object' && tenant !== null && 'allowedBlocks' in tenant
    ? (tenant as { allowedBlocks?: string[] }).allowedBlocks
    : undefined
  return getBlocksForTenant(allowed ?? []).map((b) => b.slug!).filter(Boolean)
}

/**
 * Resolve allowed block slugs from the document's tenant only (not navbar context).
 * Base pages (no tenant) get defaultBlockSlugs; pages with a tenant get that tenant's allowedBlocks.
 */
async function getAllowedBlockSlugsAsync(data: { tenant?: unknown }, req?: unknown): Promise<string[]> {
  const r = req as
    | {
        user?: unknown
        payload?: {
          findByID: (opts: {
            collection: 'tenants'
            id: number | string
            depth: number
          }) => Promise<{ allowedBlocks?: string[] }>
        }
      }
    | undefined
  const tenant = data?.tenant
  if (!tenant) {
    // When running server-side code paths (migrations, seeds, tests) we often use overrideAccess
    // and the request may have no user. In that case, allow all blocks for global pages.
    // Access control still prevents unauthenticated users from creating/updating pages.
    if (!r?.user) return allPageBlockSlugs

    const tenantIds = getUserTenantIds((r.user ?? null) as unknown as SharedUser | null)
    if (tenantIds === null) return allPageBlockSlugs
    return defaultBlockSlugs
  }

  let allowed: string[] | undefined
  if (typeof tenant === 'object' && tenant !== null && 'allowedBlocks' in tenant) {
    allowed = (tenant as { allowedBlocks?: string[] }).allowedBlocks
  }

  if (allowed === undefined && r?.payload) {
    const tenantId =
      typeof tenant === 'object' && tenant !== null && 'id' in tenant
        ? (tenant as { id: number }).id
        : tenant
    if (typeof tenantId === 'number' || typeof tenantId === 'string') {
      try {
        const tenantDoc = await r.payload.findByID({
          collection: 'tenants',
          id: tenantId,
          depth: 0,
        })
        allowed = tenantDoc?.allowedBlocks
      } catch {
        // Fall back to defaults if tenant fetch fails
      }
    }
  }

  return getBlocksForTenant(allowed ?? []).map((b) => b.slug!).filter(Boolean)
}

export const Pages: CollectionConfig<'pages'> = {
  slug: 'pages',
  access: {
    // Ensure tenant-admins can access the Pages collection in the Admin UI.
    // Without this, Payload can render a 404 Not Found for /admin/collections/pages/*.
    admin: ({ req: { user } }) => {
      if (!user) return false
      return checkRole(['admin', 'tenant-admin'], user as unknown as SharedUser)
    },
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
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: false,
      index: true,
      label: 'Assigned Tenant',
      admin: {
        position: 'sidebar',
        description:
          'Optional. Leave empty for global pages (e.g. root landing page on the main domain).',
      },
      filterOptions: ({ req }) => {
        const tenantIds = getUserTenantIds((req.user ?? null) as unknown as SharedUser | null)
        if (tenantIds === null) return true // admin: all tenants
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
              name: 'layout',
              type: 'blocks',
              blocks: pageBlocks,
              filterOptions: async ({ data, req }) => {
                return getAllowedBlockSlugsAsync(data ?? {}, req)
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
    beforeValidate: [
      async ({ data, operation, req, originalDoc }) => {
        // Ensure tenant is set so version creation and slug validation have it (tenant-admin context).
        if (!data) return data
        // Respect an explicit "no tenant" selection (global page).
        // Payload will send `null` when a relationship field is cleared.
        if (data.tenant === null) return data
        if (data.tenant) return data
        const user = (req as { user?: unknown })?.user

        // For tenant-admins, the Pages create route uses autosave and will create the draft document
        // before the user submits the form. If the tenant is not set on that initial draft, tenant-admins
        // cannot read the draft (tenantScopedReadFiltered), and the Admin UI ends up at "doc not found".
        // Prefer the TenantSelector cookie (`payload-tenant`) as the source of truth on create.
        if (user && checkRole(['tenant-admin'], user as SharedUser)) {
          const anyReq = req as unknown as {
            headers?: unknown
            req?: { headers?: Record<string, string | string[] | undefined> }
          }
          const headersAny = anyReq.headers as unknown as { get?: (name: string) => string | null; cookie?: unknown } | undefined

          const cookieHeader =
            // Next.js Headers (or compatible)
            headersAny?.get?.('cookie') ??
            // Node/Express-ish object
            (typeof headersAny?.cookie === 'string' ? headersAny.cookie : undefined) ??
            (typeof anyReq.req?.headers?.cookie === 'string' ? anyReq.req.headers.cookie : undefined) ??
            ''

          const match = typeof cookieHeader === 'string'
            ? cookieHeader.match(/(?:^|;\s*)payload-tenant=([^;]*)/)
            : null
          const raw = match?.[1] ? decodeURIComponent(match[1]) : ''
          const trimmed = String(raw || '').trim()
          if (trimmed) {
            const asNum = /^\d+$/.test(trimmed) ? parseInt(trimmed, 10) : NaN
            if (Number.isFinite(asNum)) {
              data.tenant = asNum
              return data
            }
          }
        }

        const rawTenant =
          req.context?.tenant ??
          (operation === 'update' && originalDoc?.tenant ? originalDoc.tenant : null)
        if (rawTenant) {
          data.tenant =
            typeof rawTenant === 'object' && rawTenant !== null && 'id' in rawTenant
              ? (rawTenant as { id: number }).id
              : (rawTenant as number)
        }
        return data
      },
    ],
    beforeChange: [
      populatePublishedAt,
      async ({ data, req, operation: _operation }) => {
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
